from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB
from app.services.file_classifier_service import classify_file


async def validate_uploaded_file(file: UploadFile) -> bytes:
    """
    Validate an uploaded file before saving it.

    Validation checks:
    - File must have a filename.
    - File must not be dangerous.
    - File size must not exceed the configured limit.

    Parameters
    ----------
    file : UploadFile
        Uploaded file received from the API request.

    Returns
    -------
    bytes
        File content after successful validation.

    Raises
    ------
    HTTPException
        If the uploaded file is invalid or unsafe.
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must have a filename.",
        )

    classification = classify_file(file.filename)

    if classification["file_category"] == "dangerous":
        raise HTTPException(
            status_code=400,
            detail="This file type is not allowed for security reasons.",
        )

    content = await file.read()

    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large. Maximum allowed size is {MAX_UPLOAD_SIZE_MB} MB.",
        )

    return content

    