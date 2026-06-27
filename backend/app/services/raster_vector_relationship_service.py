def generate_raster_vector_relationship_summary(
    files: list[dict],
    crs_status: str,
    bounds_status: str,
) -> dict:
    """
    Generate dataset-level raster-vector relationship summary.

    V1 purpose:
    - Detect whether raster and vector files exist together.
    - Detect likely vector role from geometry types.
    - Avoid claiming usable raster-vector relationship when CRS or bounds checks are blocked.
    """

    raster_files = [
        file
        for file in files
        if file.get("file_category") == "raster"
        or file.get("gis_type") == "raster"
    ]

    vector_files = [
        file
        for file in files
        if file.get("file_category") == "vector"
        or file.get("gis_type") == "vector"
    ]

    if not raster_files and not vector_files:
        return {
            "status": "no_spatial_relationship",
            "summary": "No raster or vector files are available for raster-vector relationship detection.",
            "raster_file_count": 0,
            "vector_file_count": 0,
            "relationship_type": "none",
            "vector_role": "none",
            "issues": [
                "Dataset does not contain spatial raster or vector files."
            ],
            "recommended_actions": [
                "Upload raster imagery and/or vector GIS data before GeoAI relationship analysis."
            ],
        }

    if raster_files and not vector_files:
        return {
            "status": "raster_only",
            "summary": (
                "Dataset contains raster imagery but no vector labels, boundaries, "
                "or annotations."
            ),
            "raster_file_count": len(raster_files),
            "vector_file_count": 0,
            "relationship_type": "imagery_only",
            "vector_role": "none",
            "issues": [
                "Raster imagery is available, but no vector labels or annotations were found."
            ],
            "recommended_actions": [
                "Upload vector labels, masks, polygons, points, or annotations if supervised GeoAI training is required.",
                "If this is an imagery-only workflow, continue with raster validation, tiling, and raster statistics.",
            ],
        }

    if vector_files and not raster_files:
        return {
            "status": "vector_only",
            "summary": (
                "Dataset contains vector GIS data but no raster imagery to relate it to."
            ),
            "raster_file_count": 0,
            "vector_file_count": len(vector_files),
            "relationship_type": "labels_or_gis_only",
            "vector_role": _infer_vector_role(vector_files),
            "issues": [
                "Vector data is available, but no raster imagery was found."
            ],
            "recommended_actions": [
                "Upload raster imagery if this vector data is intended to act as labels, annotations, or training targets.",
                "If this is a vector-only GIS workflow, continue with vector quality checks.",
            ],
        }

    vector_role = _infer_vector_role(vector_files)
    relationship_type = _infer_relationship_type(vector_role)

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        return {
            "status": "blocked_by_crs_review",
            "summary": (
                "Raster and vector files are present, but their relationship cannot be trusted "
                "until CRS issues are resolved."
            ),
            "raster_file_count": len(raster_files),
            "vector_file_count": len(vector_files),
            "relationship_type": relationship_type,
            "vector_role": vector_role,
            "issues": [
                "Raster-vector relationship detection is blocked by CRS issues."
            ],
            "recommended_actions": [
                "Resolve CRS issues first, then review raster-vector bounds, overlap, and alignment.",
                _recommended_action_for_vector_role(vector_role),
            ],
        }

    if bounds_status in {
        "missing_bounds",
        "blocked_by_crs_review",
        "no_spatial_overlap",
        "partial_spatial_overlap",
    }:
        return {
            "status": "blocked_by_bounds_review",
            "summary": (
                "Raster and vector files are present, but their spatial relationship needs "
                "bounds and overlap review before GeoAI preparation."
            ),
            "raster_file_count": len(raster_files),
            "vector_file_count": len(vector_files),
            "relationship_type": relationship_type,
            "vector_role": vector_role,
            "issues": [
                "Raster-vector relationship detection is blocked by bounds or overlap issues."
            ],
            "recommended_actions": [
                "Resolve bounds and spatial overlap issues before mask generation, tiling, or supervised training preparation.",
                _recommended_action_for_vector_role(vector_role),
            ],
        }

    if bounds_status == "overlapping_bounds":
        return {
            "status": "candidate_geoai_dataset",
            "summary": (
                "Raster and vector files are present and their bounds overlap. "
                f"The vector data appears suitable as {vector_role.replace('_', ' ')}."
            ),
            "raster_file_count": len(raster_files),
            "vector_file_count": len(vector_files),
            "relationship_type": relationship_type,
            "vector_role": vector_role,
            "issues": [],
            "recommended_actions": [
                _recommended_action_for_vector_role(vector_role),
                "Next step should check detailed spatial alignment, label quality, and preparation requirements.",
            ],
        }

    return {
        "status": "relationship_needs_review",
        "summary": (
            "Raster and vector files are present, but GeoPrep AI needs more checks before "
            "confirming their relationship."
        ),
        "raster_file_count": len(raster_files),
        "vector_file_count": len(vector_files),
        "relationship_type": relationship_type,
        "vector_role": vector_role,
        "issues": [
            "Raster-vector relationship requires additional review."
        ],
        "recommended_actions": [
            "Review CRS, bounds, geometry type, and intended GeoAI task before preparing the dataset."
        ],
    }


def _infer_vector_role(vector_files: list[dict]) -> str:
    """
    Infer likely vector role from geometry types.
    """

    geometry_types = []

    for file in vector_files:
        file_geometry_types = file.get("geometry_types") or []

        if isinstance(file_geometry_types, list):
            geometry_types.extend(
                str(geometry_type).lower()
                for geometry_type in file_geometry_types
            )

    if not geometry_types:
        return "unknown_vector_role"

    has_point = any("point" in geometry_type for geometry_type in geometry_types)
    has_polygon = any("polygon" in geometry_type for geometry_type in geometry_types)
    has_line = any("line" in geometry_type for geometry_type in geometry_types)

    if has_polygon and not has_point and not has_line:
        return "polygon_labels"

    if has_point and not has_polygon and not has_line:
        return "point_annotations"

    if has_line and not has_polygon and not has_point:
        return "linear_features"

    if has_polygon and has_point:
        return "mixed_labels_and_points"

    return "mixed_vector_geometries"


def _infer_relationship_type(vector_role: str) -> str:
    """
    Infer likely GeoAI relationship type from vector role.
    """

    if vector_role == "polygon_labels":
        return "raster_to_segmentation_labels"

    if vector_role == "point_annotations":
        return "raster_to_point_annotations"

    if vector_role == "linear_features":
        return "raster_to_linear_features"

    if vector_role in {"mixed_labels_and_points", "mixed_vector_geometries"}:
        return "raster_to_mixed_vector_annotations"

    return "raster_to_vector_reference"


def _recommended_action_for_vector_role(vector_role: str) -> str:
    """
    Return recommended action based on vector role.
    """

    if vector_role == "polygon_labels":
        return "Prepare polygons for mask generation or segmentation label creation after alignment checks."

    if vector_role == "point_annotations":
        return "Prepare points as object locations, sample points, or detection annotations after alignment checks."

    if vector_role == "linear_features":
        return "Prepare line features for extraction, road/river/network mapping, or linear feature analysis after alignment checks."

    if vector_role in {"mixed_labels_and_points", "mixed_vector_geometries"}:
        return "Review mixed vector geometry types and decide which GeoAI task each vector layer supports."

    return "Review vector geometry role before deciding the GeoAI preparation workflow."
    