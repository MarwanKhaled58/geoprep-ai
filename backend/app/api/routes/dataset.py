from fastapi import APIRouter, HTTPException

from app.schemas.dataset_schema import CreateDatasetSessionResponse, DatasetSession
from app.services.dataset_session_service import (
    create_dataset_session,
    get_dataset_session,
)

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])


@router.post("", response_model=CreateDatasetSessionResponse)
async def create_dataset() -> CreateDatasetSessionResponse:
    """
    Create a new dataset session.
    """

    dataset_session = create_dataset_session()

    return CreateDatasetSessionResponse(
        status="success",
        message="Dataset session created successfully",
        dataset_session=dataset_session,
    )


@router.get("/{dataset_session_id}", response_model=DatasetSession)
async def read_dataset(dataset_session_id: str) -> DatasetSession:
    """
    Read a dataset session by ID.
    """

    dataset_session = get_dataset_session(dataset_session_id)

    if dataset_session is None:
        raise HTTPException(
            status_code=404,
            detail="Dataset session not found",
        )

    return dataset_session
    