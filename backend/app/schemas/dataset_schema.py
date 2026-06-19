from pydantic import BaseModel, Field


class DatasetFileSummary(BaseModel):
    """
    Summary of a file attached to a dataset session.
    """

    original_filename: str
    saved_filename: str
    file_category: str
    is_supported: bool
    readiness_score: int | None = None
    readiness_status: str | None = None


class DatasetSession(BaseModel):
    """
    Dataset session v1.

    This is an in-memory representation for now.
    Later, this can become a database model.
    """

    dataset_session_id: str
    name: str
    created_at: str
    updated_at: str
    file_count: int = 0
    files: list[DatasetFileSummary] = Field(default_factory=list)


class CreateDatasetSessionResponse(BaseModel):
    """
    Response returned when a dataset session is created.
    """

    status: str
    message: str
    dataset_session: DatasetSession

    