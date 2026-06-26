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
    gis_type: str | None = None
    has_crs: bool | None = None
    crs_text: str | None = None
    epsg: int | None = None


class DatasetCrsGroup(BaseModel):
    """
    Group of spatial files sharing the same CRS representation.
    """

    crs_label: str
    file_count: int
    filenames: list[str] = Field(default_factory=list)


class DatasetCrsSummary(BaseModel):
    """
    Dataset-level CRS comparison summary.
    """

    status: str
    summary: str
    spatial_file_count: int
    files_missing_crs: list[str] = Field(default_factory=list)
    files_with_unresolved_crs: list[str] = Field(default_factory=list)
    crs_groups: list[DatasetCrsGroup] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class DatasetReadinessSummary(BaseModel):
    """
    Dataset-level readiness summary.

    This is based on uploaded file summaries.
    """

    readiness_score: int
    status: str
    summary: str
    issues: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    raster_count: int = 0
    vector_count: int = 0
    supporting_file_count: int = 0
    unsupported_file_count: int = 0
    crs_summary: DatasetCrsSummary | None = None


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
    readiness_summary: DatasetReadinessSummary | None = None


class CreateDatasetSessionResponse(BaseModel):
    """
    Response returned when a dataset session is created.
    """

    status: str
    message: str
    dataset_session: DatasetSession
    