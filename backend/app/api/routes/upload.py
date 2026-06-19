from fastapi import APIRouter, File, Form, UploadFile

from app.schemas.upload_schema import UploadResponse
from app.services.upload_service import save_uploaded_file

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

    