const API_BASE_URL = "http://127.0.0.1:8000";

export type FileWarning = {
  code: string;
  severity: string;
  message: string;
  recommended_action: string | null;
  details?: Record<string, unknown>;
};

export type ReadinessReport = {
  readiness_score: number;
  status: string;
  summary: string;
  issues: string[];
  recommended_actions: string[];
  inspection_level: string;
  can_continue_to_dataset: boolean;
};

export type DatasetCrsGroup = {
  crs_label: string;
  file_count: number;
  filenames: string[];
};

export type DatasetCrsSummary = {
  status: string;
  summary: string;
  spatial_file_count: number;
  files_missing_crs: string[];
  files_with_unresolved_crs: string[];
  crs_groups: DatasetCrsGroup[];
  issues: string[];
  recommended_actions: string[];
};

export type DatasetCrsFileGuidance = {
  filename: string;
  file_category: string;
  status: string;
  detected_crs: string | null;
  epsg: number | null;
  recommended_action: string;
};

export type DatasetCrsResolutionGuidanceSummary = {
  status: string;
  summary: string;
  recommended_target_crs: string | null;
  recommended_target_epsg: number | null;
  file_guidance: DatasetCrsFileGuidance[];
  issues: string[];
  recommended_actions: string[];
};

export type DatasetPreparationPlanStep = {
  order: number;
  title: string;
  status: string;
  description: string;
  expected_result: string;
  actions: string[];
};

export type DatasetPreparationPlanSummary = {
  status: string;
  summary: string;
  blockers: string[];
  steps: DatasetPreparationPlanStep[];
  recommended_actions: string[];
};

export type DatasetBoundsPair = {
  first_file: string;
  second_file: string;
  overlaps: boolean;
};

export type DatasetBoundsSummary = {
  status: string;
  summary: string;
  spatial_file_count: number;
  files_missing_bounds: string[];
  bounds_pairs: DatasetBoundsPair[];
  issues: string[];
  recommended_actions: string[];
};

export type DatasetRasterVectorRelationshipSummary = {
  status: string;
  summary: string;
  raster_file_count: number;
  vector_file_count: number;
  relationship_type: string;
  vector_role: string;
  issues: string[];
  recommended_actions: string[];
};

export type DatasetTaskRecommendationSummary = {
  status: string;
  summary: string;
  recommended_task: string;
  confidence: string;
  blockers: string[];
  inputs_used: Record<string, unknown>;
  issues: string[];
  recommended_actions: string[];
};

export type DatasetReadinessSummary = {
  readiness_score: number;
  status: string;
  summary: string;
  issues: string[];
  recommended_actions: string[];
  raster_count: number;
  vector_count: number;
  supporting_file_count: number;
  unsupported_file_count: number;
  crs_summary: DatasetCrsSummary | null;
  crs_resolution_guidance_summary: DatasetCrsResolutionGuidanceSummary | null;
  preparation_plan_summary: DatasetPreparationPlanSummary | null;
  bounds_summary: DatasetBoundsSummary | null;
  raster_vector_relationship_summary: DatasetRasterVectorRelationshipSummary | null;
  task_recommendation_summary: DatasetTaskRecommendationSummary | null;
};

export type DatasetFileSummary = {
  original_filename: string;
  saved_filename: string;
  file_category: string;
  is_supported: boolean;
  readiness_score: number | null;
  readiness_status: string | null;
  gis_type?: string | null;
  has_crs?: boolean | null;
  crs_text?: string | null;
  epsg?: number | null;
  bounds?: Record<string, unknown> | null;
  geometry_types?: string[];
};

export type DatasetSession = {
  dataset_session_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  files: DatasetFileSummary[];
  readiness_summary: DatasetReadinessSummary | null;
};

export type UploadResponse = {
  status: string;
  message: string;
  original_filename: string;
  saved_filename: string;
  content_type: string | null;
  file_size_bytes: number;
  saved_path: string;
  file_extension: string;
  file_category: string;
  is_supported: boolean;
  reason: string;
  gis_metadata: Record<string, unknown> | null;
  warnings?: FileWarning[];
  readiness_report?: ReadinessReport;
  dataset_session_id?: string;
  dataset_session?: DatasetSession;
};

export type BatchUploadResponse = {
  status: string;
  message: string;
  file_count: number;
  dataset_session_id: string;
  dataset_session: DatasetSession;
  uploads: UploadResponse[];
};

export async function uploadFile(
  file: File,
  datasetSessionId?: string,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  if (datasetSessionId) {
    formData.append("dataset_session_id", datasetSessionId);
  }

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail ?? "Failed to upload file");
  }

  return response.json();
}

export async function uploadFiles(
  files: File[],
  datasetSessionId?: string,
): Promise<BatchUploadResponse> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  if (datasetSessionId) {
    formData.append("dataset_session_id", datasetSessionId);
  }

  const response = await fetch(`${API_BASE_URL}/api/upload/batch`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail ?? "Failed to upload files");
  }

  return response.json();
}