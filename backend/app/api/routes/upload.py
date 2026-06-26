from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.upload_schema import BatchUploadResponse, UploadResponse
from app.services.upload_service import save_multiple_uploaded_files, save_uploaded_file

router = APIRouter(prefix="/api", tags=["Upload"])


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    dataset_session_id: str | None = Form(default=None),
) -> UploadResponse:
    """
    Upload one file and optionally attach it to a dataset session.
    """

    return await save_uploaded_file(
        file=file,
        dataset_session_id=dataset_session_id,
    )


@router.post("/upload/batch", response_model=BatchUploadResponse)
async def upload_multiple_files(
    files: list[UploadFile] = File(...),
    dataset_session_id: str | None = Form(default=None),
) -> BatchUploadResponse:
    """
    Upload multiple files and attach all of them to the same dataset session.
    """

    return await save_multiple_uploaded_files(
        files=files,
        dataset_session_id=dataset_session_id,
    )
    