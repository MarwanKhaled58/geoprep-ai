const API_BASE_URL = "http://127.0.0.1:8000";

export type HealthResponse = {
  status: string;
  message: string;
  app_name: string;
  version: string;
};

export async function getHealthStatus(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error("Failed to connect to backend");
  }

  return response.json();
}