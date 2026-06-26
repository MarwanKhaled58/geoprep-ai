from datetime import datetime, timezone
from uuid import uuid4


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

    This keeps the current upload flow working even if the frontend does not
    explicitly create a dataset session first.
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

    file_summary = {
        "original_filename": upload_result.get("original_filename"),
        "saved_filename": upload_result.get("saved_filename"),
        "file_category": upload_result.get("file_category"),
        "is_supported": upload_result.get("is_supported"),
        "readiness_score": readiness_report.get("readiness_score"),
        "readiness_status": readiness_report.get("status"),
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

    V1 composition rules:
    - supporting files only
    - vector only
    - raster only
    - raster + vector
    - mixed spatial + supporting
    - unsupported files present

    This does not yet compare CRS, bounds, resolution, or spatial alignment.
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

    status = _resolve_dataset_status(
        average_score=average_score,
        composition=composition,
        unsupported_file_count=unsupported_file_count,
    )

    adjusted_score = _adjust_dataset_score_for_composition(
        average_score=average_score,
        composition=composition,
        unsupported_file_count=unsupported_file_count,
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
        "issues": issues,
        "recommended_actions": recommended_actions,
        "raster_count": raster_count,
        "vector_count": vector_count,
        "supporting_file_count": supporting_file_count,
        "unsupported_file_count": unsupported_file_count,
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
            "Dataset contains both raster and vector data, but CRS, bounds, and spatial alignment have not been compared yet."
        )

    if supporting_file_count > 0 and composition != "supporting_files_only":
        issues.append(
            "Dataset includes supporting files that should be treated as documentation or metadata, not spatial training data."
        )

    if unsupported_file_count > 0:
        issues.append(
            f"Dataset has {unsupported_file_count} unsupported file(s)."
        )

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
        actions.append(
            "Keep supporting files as documentation, notes, or metadata."
        )

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
) -> str:
    """
    Resolve dataset status from composition and average score.
    """

    if composition == "unsupported_files_present":
        return "needs_cleanup"

    if composition == "supporting_files_only":
        return "supporting_files_only"

    if composition == "vector_only":
        return "vector_only"

    if composition == "raster_only":
        return "raster_only"

    if composition in {"raster_vector_combo", "mixed_spatial_and_supporting"}:
        if average_score >= 80 and unsupported_file_count == 0:
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
) -> int:
    """
    Adjust dataset score so composition meaning is reflected.

    This avoids cases where supporting files only look too ready just because
    their file-level score is acceptable.
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
    