// const API_BASE_URL = "http://127.0.0.1:8000";

// export type FileWarning = {
//   code: string;
//   severity: string;
//   message: string;
//   recommended_action: string | null;
//   details: Record<string, unknown>;
// };

// export type FileReadinessReport = {
//   readiness_score: number;
//   status: string;
//   summary: string;
//   issues: string[];
//   recommended_actions: string[];
//   inspection_level: string;
//   can_continue_to_dataset: boolean;
// };

// export type UploadResponse = {
//   status: string;
//   message: string;
//   original_filename: string;
//   saved_filename: string;
//   content_type: string | null;
//   file_size_bytes: number;
//   saved_path: string;
//   file_extension: string;
//   file_category: string;
//   is_supported: boolean;
//   reason: string;
//   gis_metadata: Record<string, unknown> | null;
//   warnings: FileWarning[];
//   readiness_report: FileReadinessReport;
// };

// export async function uploadFile(file: File): Promise<UploadResponse> {
//   const formData = new FormData();
//   formData.append("file", file);

//   const response = await fetch(`${API_BASE_URL}/api/upload`, {
//     method: "POST",
//     body: formData,
//   });

//   if (!response.ok) {
//     const errorData = await response.json();
//     throw new Error(errorData.detail ?? "Failed to upload file");
//   }

//   return response.json();
// }
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
};

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

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
