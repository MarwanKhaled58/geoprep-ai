from pydantic import BaseModel, Field

from app.schemas.dataset_schema import DatasetSession


class FileWarning(BaseModel):
    """
    Data quality warning generated for an uploaded file.
    """

    code: str
    severity: str
    message: str
    recommended_action: str | None = None
    details: dict = Field(default_factory=dict)


class ReadinessReport(BaseModel):
    """
    Readiness report generated for an uploaded file.
    """

    readiness_score: int
    status: str
    summary: str
    issues: list[str]
    recommended_actions: list[str]
    inspection_level: str
    can_continue_to_dataset: bool


class UploadResponse(BaseModel):
    """
    Response returned after a file is uploaded, saved, classified, inspected,
    checked for warnings, analyzed for readiness, and attached to a dataset session.
    """

    status: str
    message: str
    original_filename: str
    saved_filename: str
    content_type: str | None
    file_size_bytes: int
    saved_path: str
    file_extension: str
    file_category: str
    is_supported: bool
    reason: str
    gis_metadata: dict | None
    warnings: list[FileWarning]
    readiness_report: ReadinessReport
    dataset_session_id: str
    dataset_session: DatasetSession


class BatchUploadResponse(BaseModel):
    """
    Response returned after multiple files are uploaded to the same dataset session.
    """

    status: str
    message: str
    file_count: int
    dataset_session_id: str
    dataset_session: DatasetSession
    uploads: list[UploadResponse]
    