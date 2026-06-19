from fastapi import APIRouter, File, UploadFile

from app.schemas.upload_schema import UploadResponse
from app.services.upload_service import save_uploaded_file

router = APIRouter(
    prefix="/api",
    tags=["Upload"],
)


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)) -> UploadResponse:
    """
    Upload a file, save it to disk, and return saved file metadata.
    """

    return await save_uploaded_file(file)