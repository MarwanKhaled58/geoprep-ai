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

    This is intentionally simple in v1.
    It does not yet compare CRS, detect relationships, or infer model tasks.
    """

    if not files:
        return _generate_empty_dataset_readiness_summary()

    raster_count = _count_files_by_category(files, "raster")
    vector_count = _count_files_by_category(files, "vector")

    unsupported_file_count = len(
        [file for file in files if not file.get("is_supported", False)]
    )

    supporting_file_count = len(files) - raster_count - vector_count - unsupported_file_count

    valid_scores = [
        file.get("readiness_score")
        for file in files
        if isinstance(file.get("readiness_score"), int)
    ]

    average_score = int(sum(valid_scores) / len(valid_scores)) if valid_scores else 0

    issues: list[str] = []
    recommended_actions: list[str] = []

    if unsupported_file_count > 0:
        issues.append("Dataset contains unsupported files.")
        recommended_actions.append(
            "Remove unsupported files or replace them with supported dataset files."
        )

    if raster_count == 0:
        issues.append("Dataset does not contain raster imagery.")
        recommended_actions.append(
            "Upload raster imagery if the dataset is intended for remote sensing, segmentation, or classification workflows."
        )

    if vector_count == 0:
        issues.append("Dataset does not contain vector GIS data.")
        recommended_actions.append(
            "Upload vector data if the dataset needs labels, boundaries, annotations, or GIS feature layers."
        )

    if raster_count > 0 and vector_count > 0:
        recommended_actions.append(
            "Next step should compare raster and vector CRS, bounds, and spatial alignment."
        )

    if supporting_file_count > 0:
        recommended_actions.append(
            "Keep supporting files as metadata or documentation, but do not treat them as spatial training data."
        )

    status = _resolve_dataset_status(
        average_score=average_score,
        raster_count=raster_count,
        vector_count=vector_count,
        unsupported_file_count=unsupported_file_count,
    )

    summary = _build_dataset_summary(
        status=status,
        file_count=len(files),
        raster_count=raster_count,
        vector_count=vector_count,
        supporting_file_count=supporting_file_count,
        unsupported_file_count=unsupported_file_count,
    )

    if not recommended_actions:
        recommended_actions.append(
            "Dataset looks ready for the current inspection stage."
        )

    return {
        "readiness_score": average_score,
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


def _resolve_dataset_status(
    average_score: int,
    raster_count: int,
    vector_count: int,
    unsupported_file_count: int,
) -> str:
    """
    Resolve dataset status from simple v1 rules.
    """

    if unsupported_file_count > 0 and average_score < 60:
        return "not_ready"

    if raster_count == 0 and vector_count == 0:
        return "supporting_files_only"

    if raster_count > 0 and vector_count > 0 and average_score >= 80:
        return "ready_for_alignment_check"

    if average_score >= 70:
        return "partially_ready"

    if average_score >= 40:
        return "limited"

    return "not_ready"


def _build_dataset_summary(
    status: str,
    file_count: int,
    raster_count: int,
    vector_count: int,
    supporting_file_count: int,
    unsupported_file_count: int,
) -> str:
    """
    Build human-readable dataset summary.
    """

    return (
        f"Dataset has {file_count} file(s): "
        f"{raster_count} raster, "
        f"{vector_count} vector, "
        f"{supporting_file_count} supporting, "
        f"{unsupported_file_count} unsupported. "
        f"Current dataset status is '{status}'."
    )

    