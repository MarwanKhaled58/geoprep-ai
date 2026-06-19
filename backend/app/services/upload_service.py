from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import UPLOAD_DIR
from app.gis.file_inspector import inspect_gis_file
from app.services.dataset_session_service import (
    add_uploaded_file_to_dataset_session,
    get_or_create_dataset_session,
)
from app.services.file_classifier_service import classify_file
from app.services.file_readiness_service import generate_file_readiness_report
from app.services.file_warning_service import generate_file_warnings
from app.services.upload_validation_service import validate_uploaded_file


async def save_uploaded_file(
    file: UploadFile,
    dataset_session_id: str | None = None,
) -> dict:
    """
    Validate, save, classify, inspect, warn, analyze readiness, and attach
    an uploaded file to a dataset session.

    If no dataset session is provided, a new one is created automatically.
    """

    content = await validate_uploaded_file(file)

    dataset_session = get_or_create_dataset_session(dataset_session_id)
    active_dataset_session_id = dataset_session["dataset_session_id"]

    session_upload_dir = UPLOAD_DIR / active_dataset_session_id
    session_upload_dir.mkdir(parents=True, exist_ok=True)

    original_filename = file.filename or "uploaded_file"
    file_classification = classify_file(original_filename)

    file_extension = Path(original_filename).suffix.lower()
    saved_filename = f"{uuid4().hex}{file_extension}"
    saved_path = session_upload_dir / saved_filename

    with open(saved_path, "wb") as output_file:
        output_file.write(content)

    gis_inspection = inspect_gis_file(
        file_path=str(saved_path),
        file_category=file_classification["file_category"],
    )

    warnings = generate_file_warnings(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
    )

    readiness_report = generate_file_readiness_report(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
        warnings=warnings,
    )

    upload_result = {
        "status": "success",
        "message": "File uploaded, validated, saved, classified, inspected, checked for warnings, analyzed for readiness, and attached to dataset session successfully",
        "original_filename": original_filename,
        "saved_filename": saved_filename,
        "content_type": file.content_type,
        "file_size_bytes": len(content),
        "saved_path": str(saved_path),
        "gis_metadata": gis_inspection,
        "warnings": warnings,
        "readiness_report": readiness_report,
        "dataset_session_id": active_dataset_session_id,
        **file_classification,
    }

    updated_dataset_session = add_uploaded_file_to_dataset_session(
        dataset_session_id=active_dataset_session_id,
        upload_result=upload_result,
    )

    upload_result["dataset_session"] = updated_dataset_session

    return upload_result

    