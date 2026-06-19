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

    return dataset_session

    