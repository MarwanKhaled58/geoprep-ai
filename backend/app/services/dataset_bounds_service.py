def generate_dataset_bounds_summary(files: list[dict], crs_status: str) -> dict:
    """
    Generate dataset-level bounds and spatial relationship summary.

    Part 18 rule:
    - If CRS is missing, mixed, or unresolved, bounds review stays blocked.
    - If CRS is consistent, bounds review can run and validate corrected re-upload.
    """

    spatial_files = [
        file
        for file in files
        if file.get("file_category") in {"raster", "vector"}
        or file.get("gis_type") in {"raster", "vector"}
    ]

    if not spatial_files:
        return {
            "status": "no_spatial_files",
            "summary": "No raster or vector spatial files are available for bounds comparison.",
            "spatial_file_count": 0,
            "files_missing_bounds": [],
            "bounds_pairs": [],
            "issues": [],
            "recommended_actions": [
                "Upload raster or vector GIS files before bounds comparison."
            ],
        }

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        return {
            "status": "blocked_by_crs_review",
            "summary": (
                "Spatial bounds comparison is blocked because CRS metadata is missing, mixed, "
                "or unresolved. Resolve CRS issues before trusting bounds overlap results."
            ),
            "spatial_file_count": len(spatial_files),
            "files_missing_bounds": [],
            "bounds_pairs": [],
            "issues": [
                "Bounds comparison cannot be trusted while CRS metadata is missing, mixed, or unresolved."
            ],
            "recommended_actions": [
                "Resolve CRS issues first, then compare bounds and spatial overlap."
            ],
        }

    files_missing_bounds = [
        file.get("original_filename") or "unknown file"
        for file in spatial_files
        if not _is_valid_bounds(file.get("bounds"))
    ]

    if files_missing_bounds:
        return {
            "status": "missing_bounds",
            "summary": (
                f"Bounds comparison found {len(files_missing_bounds)} spatial file(s) "
                "without valid bounds metadata."
            ),
            "spatial_file_count": len(spatial_files),
            "files_missing_bounds": files_missing_bounds,
            "bounds_pairs": [],
            "issues": [
                "Some spatial files do not have valid bounds metadata."
            ],
            "recommended_actions": [
                "Inspect or repair files missing bounds before spatial relationship checks."
            ],
        }

    if len(spatial_files) == 1:
        return {
            "status": "single_spatial_file",
            "summary": (
                "Only one spatial file has bounds metadata. There is no second spatial file "
                "to compare against."
            ),
            "spatial_file_count": 1,
            "files_missing_bounds": [],
            "bounds_pairs": [],
            "issues": [
                "Dataset has only one spatial file, so cross-file bounds comparison is not available."
            ],
            "recommended_actions": [
                "Upload another raster or vector file if spatial relationship validation is required."
            ],
        }

    bounds_pairs = _compare_bounds_pairs(spatial_files)
    overlap_count = len([pair for pair in bounds_pairs if pair["overlaps"]])

    if overlap_count == len(bounds_pairs):
        status = "overlapping_bounds"
        issues: list[str] = []
        actions = [
            "Corrected re-upload validation passed the bounds check.",
            "Bounds overlap across spatial files. Next step should check detailed alignment and raster-vector relationship.",
        ]
    elif overlap_count == 0:
        status = "no_spatial_overlap"
        issues = [
            "Spatial files do not appear to overlap based on their bounding boxes."
        ]
        actions = [
            "CRS is now comparable, but bounds do not overlap.",
            "Confirm source data, project area, and reprojection outputs.",
            "Reproject or replace files if they should represent the same area.",
        ]
    else:
        status = "partial_spatial_overlap"
        issues = [
            "Some spatial files overlap, but others do not."
        ]
        actions = [
            "CRS is now comparable, but only partial bounds overlap was detected.",
            "Review files with non-overlapping bounds before GeoAI preparation.",
        ]

    return {
        "status": status,
        "summary": _build_bounds_summary_text(
            status=status,
            spatial_file_count=len(spatial_files),
            pair_count=len(bounds_pairs),
            overlap_count=overlap_count,
        ),
        "spatial_file_count": len(spatial_files),
        "files_missing_bounds": [],
        "bounds_pairs": bounds_pairs,
        "issues": issues,
        "recommended_actions": actions,
    }


def _compare_bounds_pairs(spatial_files: list[dict]) -> list[dict]:
    """
    Compare every pair of spatial file bounds.
    """

    pairs: list[dict] = []

    for first_index, first_file in enumerate(spatial_files):
        for second_file in spatial_files[first_index + 1:]:
            first_name = first_file.get("original_filename") or "unknown file"
            second_name = second_file.get("original_filename") or "unknown file"

            first_bounds = first_file.get("bounds")
            second_bounds = second_file.get("bounds")

            if not _is_valid_bounds(first_bounds) or not _is_valid_bounds(second_bounds):
                overlaps = False
            else:
                overlaps = _bounds_overlap(first_bounds, second_bounds)

            pairs.append(
                {
                    "first_file": first_name,
                    "second_file": second_name,
                    "overlaps": overlaps,
                }
            )

    return pairs


def _is_valid_bounds(bounds: object) -> bool:
    """
    Check whether bounds object has minx, miny, maxx, maxy.
    """

    if not isinstance(bounds, dict):
        return False

    required_keys = {"minx", "miny", "maxx", "maxy"}

    if not required_keys.issubset(bounds.keys()):
        return False

    return all(isinstance(bounds[key], int | float) for key in required_keys)


def _bounds_overlap(first_bounds: dict, second_bounds: dict) -> bool:
    """
    Check whether two bounding boxes overlap.
    """

    return not (
        first_bounds["maxx"] < second_bounds["minx"]
        or first_bounds["minx"] > second_bounds["maxx"]
        or first_bounds["maxy"] < second_bounds["miny"]
        or first_bounds["miny"] > second_bounds["maxy"]
    )


def _build_bounds_summary_text(
    status: str,
    spatial_file_count: int,
    pair_count: int,
    overlap_count: int,
) -> str:
    """
    Build human-readable bounds summary.
    """

    if status == "overlapping_bounds":
        return (
            f"Corrected re-upload validation passed. Bounds comparison found overlap "
            f"in all {pair_count} spatial file pair(s) across "
            f"{spatial_file_count} spatial file(s)."
        )

    if status == "no_spatial_overlap":
        return (
            f"Corrected re-upload validation can run because CRS is comparable, "
            f"but bounds comparison found no overlap across {pair_count} spatial file pair(s)."
        )

    if status == "partial_spatial_overlap":
        return (
            f"Corrected re-upload validation can run because CRS is comparable. "
            f"Bounds comparison found {overlap_count} overlapping pair(s) out of "
            f"{pair_count} spatial file pair(s)."
        )

    return "Bounds comparison completed."
    