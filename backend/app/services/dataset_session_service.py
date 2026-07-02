from datetime import datetime, timezone
from uuid import uuid4

from app.services.crs_correction_instruction_service import (
    generate_crs_correction_instruction_summary,
)
from app.services.crs_resolution_guidance_service import (
    generate_crs_resolution_guidance_summary,
)
from app.services.dataset_bounds_service import generate_dataset_bounds_summary
from app.services.dataset_preparation_plan_service import (
    generate_dataset_preparation_plan_summary,
)
from app.services.dataset_task_recommendation_service import (
    generate_dataset_task_recommendation_summary,
)
from app.services.raster_vector_relationship_service import (
    generate_raster_vector_relationship_summary,
)


_DATASET_SESSIONS: dict[str, dict] = {}


def _utc_now_iso() -> str:
    """
    Return current UTC time in ISO format.
    """

    return datetime.now(timezone.utc).isoformat()


def create_dataset_session(name: str | None = None) -> dict:
    """
    Create a new in-memory dataset session.
    """

    dataset_session_id = uuid4().hex
    now = _utc_now_iso()

    dataset_session = {
        "dataset_session_id": dataset_session_id,
        "name": name or f"Dataset Session {dataset_session_id[:8]}",
        "created_at": now,
        "updated_at": now,
        "file_count": 0,
        "files": [],
        "readiness_summary": _generate_empty_dataset_readiness_summary(),
    }

    _DATASET_SESSIONS[dataset_session_id] = dataset_session

    return dataset_session


def get_dataset_session(dataset_session_id: str) -> dict | None:
    """
    Get a dataset session by ID.
    """

    return _DATASET_SESSIONS.get(dataset_session_id)


def get_or_create_dataset_session(dataset_session_id: str | None = None) -> dict:
    """
    Get an existing session or create a new one.
    """

    if dataset_session_id:
        existing_session = get_dataset_session(dataset_session_id)

        if existing_session:
            return existing_session

    return create_dataset_session()


def add_uploaded_file_to_dataset_session(
    dataset_session_id: str,
    upload_result: dict,
) -> dict:
    """
    Attach uploaded file summary to a dataset session.
    """

    dataset_session = get_dataset_session(dataset_session_id)

    if dataset_session is None:
        dataset_session = create_dataset_session()

    readiness_report = upload_result.get("readiness_report") or {}
    gis_metadata = upload_result.get("gis_metadata") or {}
    metadata = gis_metadata.get("metadata") or {}
    crs = gis_metadata.get("crs") or {}

    file_summary = {
        "original_filename": upload_result.get("original_filename"),
        "saved_filename": upload_result.get("saved_filename"),
        "file_category": upload_result.get("file_category"),
        "is_supported": upload_result.get("is_supported"),
        "readiness_score": readiness_report.get("readiness_score"),
        "readiness_status": readiness_report.get("status"),
        "gis_type": gis_metadata.get("gis_type"),
        "has_crs": crs.get("has_crs"),
        "crs_text": crs.get("crs_text"),
        "epsg": crs.get("epsg"),
        "bounds": _normalize_bounds(metadata.get("bounds")),
        "geometry_types": metadata.get("geometry_types") or [],
    }

    dataset_session["files"].append(file_summary)
    dataset_session["file_count"] = len(dataset_session["files"])
    dataset_session["updated_at"] = _utc_now_iso()
    dataset_session["readiness_summary"] = generate_dataset_readiness_summary(
        dataset_session["files"]
    )

    return dataset_session


def generate_dataset_readiness_summary(files: list[dict]) -> dict:
    """
    Generate a dataset-level readiness summary from file summaries.
    """

    if not files:
        return _generate_empty_dataset_readiness_summary()

    raster_count = _count_files_by_category(files, "raster")
    vector_count = _count_files_by_category(files, "vector")

    unsupported_file_count = len(
        [file for file in files if not file.get("is_supported", False)]
    )

    supporting_file_count = (
        len(files) - raster_count - vector_count - unsupported_file_count
    )

    valid_scores = [
        file.get("readiness_score")
        for file in files
        if isinstance(file.get("readiness_score"), int)
    ]

    average_score = int(sum(valid_scores) / len(valid_scores)) if valid_scores else 0

    composition = _detect_dataset_composition(
        raster_count=raster_count,
        vector_count=vector_count,
        supporting_file_count=supporting_file_count,
        unsupported_file_count=unsupported_file_count,
    )

    crs_summary = generate_dataset_crs_summary(files)

    crs_resolution_guidance_summary = generate_crs_resolution_guidance_summary(
        files=files,
        crs_summary=crs_summary,
    )

    crs_correction_instruction_summary = (
        generate_crs_correction_instruction_summary(
            crs_summary=crs_summary,
            crs_resolution_guidance_summary=crs_resolution_guidance_summary,
        )
    )

    bounds_summary = generate_dataset_bounds_summary(
        files=files,
        crs_status=crs_summary["status"],
    )

    raster_vector_relationship_summary = generate_raster_vector_relationship_summary(
        files=files,
        crs_status=crs_summary["status"],
        bounds_status=bounds_summary["status"],
    )

    task_recommendation_summary = generate_dataset_task_recommendation_summary(
        relationship_summary=raster_vector_relationship_summary,
        crs_status=crs_summary["status"],
        bounds_status=bounds_summary["status"],
    )

    status = _resolve_dataset_status(
        average_score=average_score,
        composition=composition,
        unsupported_file_count=unsupported_file_count,
        crs_status=crs_summary["status"],
        bounds_status=bounds_summary["status"],
    )

    preparation_plan_summary = generate_dataset_preparation_plan_summary(
        dataset_status=status,
        crs_summary=crs_summary,
        crs_resolution_guidance_summary=crs_resolution_guidance_summary,
        bounds_summary=bounds_summary,
        raster_vector_relationship_summary=raster_vector_relationship_summary,
        task_recommendation_summary=task_recommendation_summary,
    )

    issues = _build_composition_issues(
        composition=composition,
        raster_count=raster_count,
        vector_count=vector_count,
        supporting_file_count=supporting_file_count,
        unsupported_file_count=unsupported_file_count,
    )

    recommended_actions = _build_composition_recommended_actions(
        composition=composition,
        raster_count=raster_count,
        vector_count=vector_count,
        supporting_file_count=supporting_file_count,
        unsupported_file_count=unsupported_file_count,
    )

    issues.extend(crs_summary["issues"])
    recommended_actions.extend(crs_summary["recommended_actions"])

    issues.extend(crs_resolution_guidance_summary["issues"])
    recommended_actions.extend(crs_resolution_guidance_summary["recommended_actions"])

    recommended_actions.extend(
        crs_correction_instruction_summary["recommended_actions"]
    )

    issues.extend(bounds_summary["issues"])
    recommended_actions.extend(bounds_summary["recommended_actions"])

    issues.extend(raster_vector_relationship_summary["issues"])
    recommended_actions.extend(
        raster_vector_relationship_summary["recommended_actions"]
    )

    issues.extend(task_recommendation_summary["issues"])
    recommended_actions.extend(task_recommendation_summary["recommended_actions"])

    recommended_actions.extend(preparation_plan_summary["recommended_actions"])

    adjusted_score = _adjust_dataset_score_for_composition(
        average_score=average_score,
        composition=composition,
        unsupported_file_count=unsupported_file_count,
        crs_status=crs_summary["status"],
        bounds_status=bounds_summary["status"],
    )

    summary = _build_dataset_summary(
        status=status,
        composition=composition,
        file_count=len(files),
        raster_count=raster_count,
        vector_count=vector_count,
        supporting_file_count=supporting_file_count,
        unsupported_file_count=unsupported_file_count,
    )

    return {
        "readiness_score": adjusted_score,
        "status": status,
        "summary": summary,
        "issues": _deduplicate_text_items(issues),
        "recommended_actions": _deduplicate_text_items(recommended_actions),
        "raster_count": raster_count,
        "vector_count": vector_count,
        "supporting_file_count": supporting_file_count,
        "unsupported_file_count": unsupported_file_count,
        "crs_summary": crs_summary,
        "crs_resolution_guidance_summary": crs_resolution_guidance_summary,
        "crs_correction_instruction_summary": crs_correction_instruction_summary,
        "preparation_plan_summary": preparation_plan_summary,
        "bounds_summary": bounds_summary,
        "raster_vector_relationship_summary": raster_vector_relationship_summary,
        "task_recommendation_summary": task_recommendation_summary,
    }


def generate_dataset_crs_summary(files: list[dict]) -> dict:
    """
    Compare CRS information across spatial files in the dataset.

    Part 18 update:
    - Normalize known CRS text into EPSG labels before comparison.
    - This allows corrected re-uploads to validate successfully when one file
      reports EPSG directly and another reports equivalent WKT text.
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
            "summary": "No raster or vector spatial files are available for CRS comparison.",
            "spatial_file_count": 0,
            "files_missing_crs": [],
            "files_with_unresolved_crs": [],
            "crs_groups": [],
            "issues": [],
            "recommended_actions": [
                "Upload raster or vector GIS files before CRS comparison."
            ],
        }

    files_missing_crs = []
    files_with_unresolved_crs = []
    crs_groups_map: dict[str, list[str]] = {}

    for file in spatial_files:
        filename = file.get("original_filename") or "unknown file"
        has_crs = file.get("has_crs")
        epsg = file.get("epsg")
        crs_text = file.get("crs_text")

        if not has_crs:
            files_missing_crs.append(filename)
            continue

        crs_label = _build_comparable_crs_label(
            epsg=epsg,
            crs_text=crs_text,
        )

        if crs_label is None:
            files_with_unresolved_crs.append(filename)
            crs_label = "Unresolved CRS"

        crs_groups_map.setdefault(crs_label, []).append(filename)

    crs_groups = [
        {
            "crs_label": crs_label,
            "file_count": len(filenames),
            "filenames": filenames,
        }
        for crs_label, filenames in crs_groups_map.items()
    ]

    issues: list[str] = []
    actions: list[str] = []

    if files_missing_crs:
        issues.append("Some spatial files are missing CRS metadata.")
        actions.append(
            "Define the correct CRS for files missing CRS metadata before spatial alignment or model preparation."
        )

    if files_with_unresolved_crs:
        issues.append(
            "Some spatial files have CRS metadata that could not be resolved to an EPSG code."
        )
        actions.append(
            "Review unresolved CRS definitions manually and confirm whether they match the target dataset CRS."
        )

    if len(crs_groups) > 1:
        issues.append("Spatial files use different CRS definitions.")
        actions.append(
            "Reproject raster and vector data into one common CRS before bounds comparison, alignment, tiling, or mask generation."
        )

    if files_missing_crs:
        status = "missing_crs"
    elif len(crs_groups) > 1:
        status = "mixed_crs"
    elif files_with_unresolved_crs:
        status = "unresolved_crs"
    else:
        status = "consistent_crs"

    summary = _build_crs_summary_text(
        status=status,
        spatial_file_count=len(spatial_files),
        crs_groups=crs_groups,
        files_missing_crs=files_missing_crs,
        files_with_unresolved_crs=files_with_unresolved_crs,
    )

    if status == "consistent_crs":
        actions.append(
            "CRS is consistent across spatial files. Next step should compare bounds and spatial overlap."
        )

        if any(_has_inferred_crs_label(file) for file in spatial_files):
            actions.append(
                "At least one CRS was normalized from CRS text to an EPSG label for comparison."
            )

    return {
        "status": status,
        "summary": summary,
        "spatial_file_count": len(spatial_files),
        "files_missing_crs": files_missing_crs,
        "files_with_unresolved_crs": files_with_unresolved_crs,
        "crs_groups": crs_groups,
        "issues": _deduplicate_text_items(issues),
        "recommended_actions": _deduplicate_text_items(actions),
    }


def _generate_empty_dataset_readiness_summary() -> dict:
    """
    Generate readiness summary for an empty dataset session.
    """

    return {
        "readiness_score": 0,
        "status": "empty",
        "summary": "Dataset session has no uploaded files yet.",
        "issues": ["No files have been uploaded to this dataset session."],
        "recommended_actions": ["Upload at least one raster or vector GIS file."],
        "raster_count": 0,
        "vector_count": 0,
        "supporting_file_count": 0,
        "unsupported_file_count": 0,
        "crs_summary": {
            "status": "no_spatial_files",
            "summary": "No raster or vector spatial files are available for CRS comparison.",
            "spatial_file_count": 0,
            "files_missing_crs": [],
            "files_with_unresolved_crs": [],
            "crs_groups": [],
            "issues": [],
            "recommended_actions": [
                "Upload raster or vector GIS files before CRS comparison."
            ],
        },
        "crs_resolution_guidance_summary": {
            "status": "not_applicable",
            "summary": "No spatial files are available for CRS resolution guidance.",
            "recommended_target_crs": None,
            "recommended_target_epsg": None,
            "file_guidance": [],
            "issues": [],
            "recommended_actions": [
                "Upload raster or vector GIS files before CRS resolution guidance."
            ],
        },
        "crs_correction_instruction_summary": {
            "status": "not_required",
            "summary": (
                "No CRS correction instructions are available until spatial files "
                "are uploaded."
            ),
            "target_crs": None,
            "target_epsg": None,
            "files_to_reproject": [],
            "files_to_confirm": [],
            "arcgis_pro_steps": [],
            "qgis_steps": [],
            "python_steps": [],
            "recommended_actions": [
                "Upload raster or vector GIS files before generating CRS correction instructions."
            ],
        },
        "preparation_plan_summary": {
            "status": "plan_not_available",
            "summary": "No preparation plan is available until dataset files are uploaded.",
            "blockers": ["no_dataset_files"],
            "steps": [],
            "recommended_actions": [
                "Upload raster imagery and/or vector GIS data before generating a preparation plan."
            ],
        },
        "bounds_summary": {
            "status": "no_spatial_files",
            "summary": "No raster or vector spatial files are available for bounds comparison.",
            "spatial_file_count": 0,
            "files_missing_bounds": [],
            "bounds_pairs": [],
            "issues": [],
            "recommended_actions": [
                "Upload raster or vector GIS files before bounds comparison."
            ],
        },
        "raster_vector_relationship_summary": {
            "status": "no_spatial_relationship",
            "summary": (
                "No raster or vector files are available for raster-vector relationship detection."
            ),
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
        },
        "task_recommendation_summary": {
            "status": "task_needs_review",
            "summary": "No GeoAI task can be recommended until dataset files are uploaded.",
            "recommended_task": "task_needs_manual_review",
            "confidence": "low",
            "blockers": ["no_dataset_files"],
            "inputs_used": {},
            "issues": [
                "No dataset files are available for task recommendation."
            ],
            "recommended_actions": [
                "Upload raster imagery and/or vector GIS data before task recommendation."
            ],
        },
    }


def _count_files_by_category(files: list[dict], category: str) -> int:
    """
    Count files by file category.
    """

    return len([file for file in files if file.get("file_category") == category])


def _detect_dataset_composition(
    raster_count: int,
    vector_count: int,
    supporting_file_count: int,
    unsupported_file_count: int,
) -> str:
    """
    Detect dataset composition from file categories.
    """

    if unsupported_file_count > 0:
        return "unsupported_files_present"

    if raster_count == 0 and vector_count == 0 and supporting_file_count > 0:
        return "supporting_files_only"

    if raster_count == 0 and vector_count > 0:
        return "vector_only"

    if raster_count > 0 and vector_count == 0:
        return "raster_only"

    if raster_count > 0 and vector_count > 0 and supporting_file_count > 0:
        return "mixed_spatial_and_supporting"

    if raster_count > 0 and vector_count > 0:
        return "raster_vector_combo"

    return "unknown"


def _build_composition_issues(
    composition: str,
    raster_count: int,
    vector_count: int,
    supporting_file_count: int,
    unsupported_file_count: int,
) -> list[str]:
    """
    Build dataset issues from composition rules.
    """

    issues: list[str] = []

    if composition == "unsupported_files_present":
        issues.append("Dataset contains unsupported files.")

    if composition == "supporting_files_only":
        issues.append("Dataset contains only supporting files and no spatial GIS data.")

    if composition == "vector_only":
        issues.append("Dataset contains vector GIS data but no raster imagery.")

    if composition == "raster_only":
        issues.append("Dataset contains raster imagery but no vector GIS labels or boundaries.")

    if composition in {"raster_vector_combo", "mixed_spatial_and_supporting"}:
        issues.append(
            "Dataset contains both raster and vector data, but CRS, bounds, and spatial alignment still need to be reviewed."
        )

    if supporting_file_count > 0 and composition != "supporting_files_only":
        issues.append(
            "Dataset includes supporting files that should be treated as documentation or metadata, not spatial training data."
        )

    if unsupported_file_count > 0:
        issues.append(f"Dataset has {unsupported_file_count} unsupported file(s).")

    if raster_count == 0 and composition not in {"supporting_files_only", "vector_only"}:
        issues.append("Dataset does not contain raster imagery.")

    if vector_count == 0 and composition not in {"supporting_files_only", "raster_only"}:
        issues.append("Dataset does not contain vector GIS data.")

    return issues


def _build_composition_recommended_actions(
    composition: str,
    raster_count: int,
    vector_count: int,
    supporting_file_count: int,
    unsupported_file_count: int,
) -> list[str]:
    """
    Build recommended actions from composition rules.
    """

    actions: list[str] = []

    if composition == "unsupported_files_present":
        actions.append(
            "Remove unsupported files or replace them with supported dataset files."
        )

    if composition == "supporting_files_only":
        actions.append(
            "Upload raster imagery or vector GIS data before preparing a GeoAI dataset."
        )
        actions.append("Keep supporting files as documentation, notes, or metadata.")

    if composition == "vector_only":
        actions.append(
            "Upload raster imagery if the vector data is intended to be used as labels, boundaries, or annotations for GeoAI training."
        )
        actions.append(
            "If this is a vector-only GIS dataset, continue with vector quality checks before model preparation."
        )

    if composition == "raster_only":
        actions.append(
            "Upload vector labels, masks, or annotations if the raster is intended for supervised training."
        )
        actions.append(
            "If this is an imagery-only dataset, continue with raster validation, tiling, and statistics."
        )

    if composition in {"raster_vector_combo", "mixed_spatial_and_supporting"}:
        actions.append(
            "Next step should compare raster and vector CRS, bounds, and spatial alignment."
        )
        actions.append(
            "After alignment checks, this dataset may be suitable for mask generation, tiling, or supervised GeoAI preparation."
        )

    if supporting_file_count > 0 and composition != "supporting_files_only":
        actions.append(
            "Keep supporting files in the dataset package as metadata or documentation."
        )

    if not actions:
        actions.append("Dataset looks ready for the current inspection stage.")

    return actions


def _resolve_dataset_status(
    average_score: int,
    composition: str,
    unsupported_file_count: int,
    crs_status: str,
    bounds_status: str,
) -> str:
    """
    Resolve dataset status from composition, CRS, bounds, and average score.
    """

    if composition == "unsupported_files_present":
        return "needs_cleanup"

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        return "needs_crs_review"

    if bounds_status in {"missing_bounds", "no_spatial_overlap"}:
        return "needs_spatial_review"

    if composition == "supporting_files_only":
        return "supporting_files_only"

    if composition == "vector_only":
        return "vector_only"

    if composition == "raster_only":
        return "raster_only"

    if composition in {"raster_vector_combo", "mixed_spatial_and_supporting"}:
        if bounds_status == "overlapping_bounds" and average_score >= 80:
            return "ready_for_alignment_check"

        return "partially_ready"

    if average_score >= 70:
        return "partially_ready"

    if average_score >= 40:
        return "limited"

    return "not_ready"


def _adjust_dataset_score_for_composition(
    average_score: int,
    composition: str,
    unsupported_file_count: int,
    crs_status: str,
    bounds_status: str,
) -> int:
    """
    Adjust dataset score so composition, CRS, and bounds meaning are reflected.
    """

    score = average_score

    if composition == "supporting_files_only":
        score = min(score, 40)

    if composition == "vector_only":
        score = min(score, 70)

    if composition == "raster_only":
        score = min(score, 70)

    if composition == "unsupported_files_present":
        score = min(score, 50)

    if composition in {"raster_vector_combo", "mixed_spatial_and_supporting"}:
        score = min(score, 85)

    if crs_status == "missing_crs":
        score = min(score, 55)

    if crs_status == "mixed_crs":
        score = min(score, 65)

    if crs_status == "unresolved_crs":
        score = min(score, 80)

    if bounds_status == "missing_bounds":
        score = min(score, 60)

    if bounds_status == "no_spatial_overlap":
        score = min(score, 55)

    if bounds_status == "partial_spatial_overlap":
        score = min(score, 75)

    if bounds_status == "blocked_by_crs_review":
        score = min(score, 65)

    if unsupported_file_count > 0:
        score -= min(unsupported_file_count * 10, 30)

    return max(score, 0)


def _build_dataset_summary(
    status: str,
    composition: str,
    file_count: int,
    raster_count: int,
    vector_count: int,
    supporting_file_count: int,
    unsupported_file_count: int,
) -> str:
    """
    Build human-readable dataset summary.
    """

    composition_label = composition.replace("_", " ")

    return (
        f"Dataset composition is '{composition_label}'. "
        f"It has {file_count} file(s): "
        f"{raster_count} raster, "
        f"{vector_count} vector, "
        f"{supporting_file_count} supporting, "
        f"{unsupported_file_count} unsupported. "
        f"Current dataset status is '{status}'."
    )


def _build_crs_summary_text(
    status: str,
    spatial_file_count: int,
    crs_groups: list[dict],
    files_missing_crs: list[str],
    files_with_unresolved_crs: list[str],
) -> str:
    """
    Build human-readable CRS summary.
    """

    if status == "no_spatial_files":
        return "No spatial files are available for CRS comparison."

    if status == "missing_crs":
        return (
            f"CRS comparison found {len(files_missing_crs)} file(s) missing CRS metadata "
            f"out of {spatial_file_count} spatial file(s)."
        )

    if status == "mixed_crs":
        return (
            f"CRS comparison found {len(crs_groups)} different CRS definition(s) "
            f"across {spatial_file_count} spatial file(s)."
        )

    if status == "unresolved_crs":
        return (
            f"All spatial files have CRS metadata, but {len(files_with_unresolved_crs)} "
            "file(s) could not be resolved to EPSG codes."
        )

    return (
        f"All {spatial_file_count} spatial file(s) use one consistent CRS definition."
    )


def _build_comparable_crs_label(
    epsg: object,
    crs_text: object,
) -> str | None:
    """
    Build a CRS label suitable for dataset-level comparison.

    This prevents equivalent CRS values from being treated as different only
    because one file reports EPSG and another reports WKT text.
    """

    if isinstance(epsg, int):
        return f"EPSG:{epsg}"

    inferred_epsg = _infer_epsg_from_crs_text(crs_text)

    if inferred_epsg:
        return f"EPSG:{inferred_epsg}"

    if isinstance(crs_text, str) and crs_text.strip():
        return None

    return None


def _infer_epsg_from_crs_text(crs_text: object) -> int | None:
    """
    Infer common EPSG codes from CRS text.

    This is intentionally conservative. More CRS inference rules can be added
    later as GeoPrep AI supports more project areas and CRS definitions.
    """

    if not isinstance(crs_text, str):
        return None

    normalized = crs_text.lower()

    if "epsg:32618" in normalized:
        return 32618

    if "wgs 84" in normalized and "utm zone 18n" in normalized:
        return 32618

    if "epsg:4326" in normalized:
        return 4326

    if "wgs 84" in normalized and "longlat" in normalized:
        return 4326

    return None


def _has_inferred_crs_label(file: dict) -> bool:
    """
    Return True when CRS was inferred from text rather than direct EPSG metadata.
    """

    epsg = file.get("epsg")
    crs_text = file.get("crs_text")

    return not isinstance(epsg, int) and _infer_epsg_from_crs_text(crs_text) is not None


def _normalize_bounds(bounds: object) -> dict | None:
    """
    Normalize vector and raster bounds into minx, miny, maxx, maxy.
    """

    if not isinstance(bounds, dict):
        return None

    if {"minx", "miny", "maxx", "maxy"}.issubset(bounds.keys()):
        return {
            "minx": bounds.get("minx"),
            "miny": bounds.get("miny"),
            "maxx": bounds.get("maxx"),
            "maxy": bounds.get("maxy"),
        }

    if {"left", "bottom", "right", "top"}.issubset(bounds.keys()):
        return {
            "minx": bounds.get("left"),
            "miny": bounds.get("bottom"),
            "maxx": bounds.get("right"),
            "maxy": bounds.get("top"),
        }

    return None


def _deduplicate_text_items(items: list[str]) -> list[str]:
    """
    Remove duplicate text items while preserving order.
    """

    deduplicated = []

    for item in items:
        if item not in deduplicated:
            deduplicated.append(item)

    return deduplicated
    