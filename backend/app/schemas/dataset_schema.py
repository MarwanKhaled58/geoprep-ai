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
    bounds: dict | None = None
    geometry_types: list[str] = Field(default_factory=list)


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


class DatasetCrsFileGuidance(BaseModel):
    """
    Per-file CRS resolution guidance.
    """

    filename: str
    file_category: str
    status: str
    detected_crs: str | None = None
    epsg: int | None = None
    recommended_action: str


class DatasetCrsResolutionGuidanceSummary(BaseModel):
    """
    Dataset-level CRS resolution guidance summary.
    """

    status: str
    summary: str
    recommended_target_crs: str | None = None
    recommended_target_epsg: int | None = None
    file_guidance: list[DatasetCrsFileGuidance] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class DatasetPreparationPlanStep(BaseModel):
    """
    One dataset preparation plan step.
    """

    order: int
    title: str
    status: str
    description: str
    expected_result: str
    actions: list[str] = Field(default_factory=list)


class DatasetPreparationPlanSummary(BaseModel):
    """
    Dataset-level preparation plan summary.
    """

    status: str
    summary: str
    blockers: list[str] = Field(default_factory=list)
    steps: list[DatasetPreparationPlanStep] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class DatasetBoundsPair(BaseModel):
    """
    Bounds relationship between two spatial files.
    """

    first_file: str
    second_file: str
    overlaps: bool


class DatasetBoundsSummary(BaseModel):
    """
    Dataset-level bounds and spatial relationship summary.
    """

    status: str
    summary: str
    spatial_file_count: int
    files_missing_bounds: list[str] = Field(default_factory=list)
    bounds_pairs: list[DatasetBoundsPair] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class DatasetRasterVectorRelationshipSummary(BaseModel):
    """
    Dataset-level raster-vector relationship summary.
    """

    status: str
    summary: str
    raster_file_count: int
    vector_file_count: int
    relationship_type: str
    vector_role: str
    issues: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class DatasetTaskRecommendationSummary(BaseModel):
    """
    Dataset-level GeoAI task recommendation summary.
    """

    status: str
    summary: str
    recommended_task: str
    confidence: str
    blockers: list[str] = Field(default_factory=list)
    inputs_used: dict = Field(default_factory=dict)
    issues: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class DatasetReadinessSummary(BaseModel):
    """
    Dataset-level readiness summary.
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
    crs_resolution_guidance_summary: DatasetCrsResolutionGuidanceSummary | None = None
    preparation_plan_summary: DatasetPreparationPlanSummary | None = None
    bounds_summary: DatasetBoundsSummary | None = None
    raster_vector_relationship_summary: DatasetRasterVectorRelationshipSummary | None = None
    task_recommendation_summary: DatasetTaskRecommendationSummary | None = None


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
    