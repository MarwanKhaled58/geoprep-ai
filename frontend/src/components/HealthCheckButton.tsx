import { useState } from "react";
import { getHealthStatus, type HealthResponse } from "../api/healthApi";

function HealthCheckButton() {
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string>("");

  async function handleHealthCheck(): Promise<void> {
    try {
      setError("");
      const data = await getHealthStatus();
      setHealthStatus(data);
    } catch (err) {
      setHealthStatus(null);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unknown error occurred");
      }
    }
  }

  return (
    <div>
      <button onClick={handleHealthCheck}>Test Backend Connection</button>

      {healthStatus && (
        <div>
          <h3>{healthStatus.message}</h3>
          <p>Status: {healthStatus.status}</p>
          <p>App: {healthStatus.app_name}</p>
          <p>Version: {healthStatus.version}</p>
        </div>
      )}

      {error && <p>{error}</p>}
    </div>
  );
}

export default HealthCheckButton;

