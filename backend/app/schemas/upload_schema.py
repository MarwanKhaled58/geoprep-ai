from pydantic import BaseModel, Field


class FileWarning(BaseModel):
    """
    Data quality warning generated for an uploaded file.
    """

    code: str
    severity: str
    message: str
    recommended_action: str | None = None
    details: dict = Field(default_factory=dict)


class FileReadinessReport(BaseModel):
    """
    First readiness analysis report for an uploaded file.
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
    Response returned after a file is uploaded, saved, classified, and inspected.
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
    readiness_report: FileReadinessReport

