import { useState } from "react";
import { uploadFile, type UploadResponse } from "../api/uploadApi";

function FileUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [datasetSessionId, setDatasetSessionId] = useState<string | undefined>();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadResult(null);
    setError("");
  }

  async function handleUpload(): Promise<void> {
    if (!selectedFile) {
      setError("Please select a file first.");
      return;
    }

    try {
      setIsUploading(true);
      setError("");
      setUploadResult(null);

      const result = await uploadFile(selectedFile, datasetSessionId);

      if (result.dataset_session_id) {
        setDatasetSessionId(result.dataset_session_id);
      }

      setUploadResult(result);
    } catch (err) {
      setUploadResult(null);
      setError(err instanceof Error ? err.message : "Unknown upload error");
    } finally {
      setIsUploading(false);
    }
  }

  const warnings = uploadResult?.warnings ?? [];
  const readinessReport = uploadResult?.readiness_report;
  const datasetSession = uploadResult?.dataset_session;
  const datasetReadinessSummary = datasetSession?.readiness_summary;

  return (
    <section className="upload-section">
      <div className="card">
        <h2>Upload GIS File</h2>

        <p className="section-description">
          Upload a raster, vector, image, document, or supporting dataset file.
          GeoPrep AI will classify it, inspect GIS metadata when possible, and
          generate warnings and readiness feedback.
        </p>

        <div className="upload-controls">
          <input type="file" onChange={handleFileChange} />

          <button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload File"}
          </button>
        </div>

        {selectedFile && (
          <p className="selected-file">
            Selected file: <strong>{selectedFile.name}</strong>
          </p>
        )}

        {error && <div className="error-box">{error}</div>}
      </div>

      {uploadResult && (
        <div className="results-grid">
          <div className="card">
            <h3>File Summary</h3>

            <div className="info-grid">
              <InfoItem
                label="Original filename"
                value={uploadResult.original_filename}
              />
              <InfoItem
                label="Saved filename"
                value={uploadResult.saved_filename}
              />
              <InfoItem
                label="Content type"
                value={uploadResult.content_type ?? "Unknown"}
              />
              <InfoItem
                label="Size"
                value={`${uploadResult.file_size_bytes} bytes`}
              />
              <InfoItem label="Extension" value={uploadResult.file_extension} />
              <InfoItem label="Category" value={uploadResult.file_category} />
              <InfoItem
                label="Supported"
                value={uploadResult.is_supported ? "Yes" : "No"}
              />
              <InfoItem label="Reason" value={uploadResult.reason} />
            </div>
          </div>

          {readinessReport && (
            <div className="card">
              <div className="card-header-row">
                <h3>File Readiness Report</h3>

                <span className={`status-pill status-${readinessReport.status}`}>
                  {readinessReport.status}
                </span>
              </div>

              <div className="score-box">
                <span className="score-number">
                  {readinessReport.readiness_score}
                </span>
                <span className="score-total">/100</span>
              </div>

              <p>{readinessReport.summary}</p>

              <div className="info-grid">
                <InfoItem
                  label="Can continue to dataset"
                  value={readinessReport.can_continue_to_dataset ? "Yes" : "No"}
                />
                <InfoItem
                  label="Inspection level"
                  value={readinessReport.inspection_level}
                />
              </div>

              <h4>Issues</h4>

              {readinessReport.issues.length === 0 ? (
                <p className="muted-text">No readiness issues detected.</p>
              ) : (
                <ul>
                  {readinessReport.issues.map((issue, index) => (
                    <li key={`issue-${index}`}>{issue}</li>
                  ))}
                </ul>
              )}

              <h4>Recommended Actions</h4>

              <ul>
                {readinessReport.recommended_actions.map((action, index) => (
                  <li key={`action-${index}`}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <h3>File Warnings</h3>

            {warnings.length === 0 ? (
              <div className="success-box">No warnings detected.</div>
            ) : (
              <div className="warning-list">
                {warnings.map((warning, index) => (
                  <div
                    className={`warning-item warning-${warning.severity}`}
                    key={`${warning.code}-${index}`}
                  >
                    <div className="warning-title">
                      <span>{warning.severity.toUpperCase()}</span>
                      <strong>{warning.code}</strong>
                    </div>

                    <p>{warning.message}</p>

                    {warning.recommended_action && (
                      <p className="recommended-action">
                        Recommended action: {warning.recommended_action}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {datasetSession && (
            <div className="card">
              <h3>Dataset Session</h3>

              <div className="info-grid">
                <InfoItem
                  label="Session ID"
                  value={datasetSession.dataset_session_id}
                />
                <InfoItem label="Name" value={datasetSession.name} />
                <InfoItem
                  label="File count"
                  value={String(datasetSession.file_count)}
                />
                <InfoItem label="Updated at" value={datasetSession.updated_at} />
              </div>

              {datasetReadinessSummary && (
                <>
                  <h4>Dataset Readiness Summary</h4>

                  <div className="card-header-row">
                    <div className="score-box">
                      <span className="score-number">
                        {datasetReadinessSummary.readiness_score}
                      </span>
                      <span className="score-total">/100</span>
                    </div>

                    <span
                      className={`status-pill status-${datasetReadinessSummary.status}`}
                    >
                      {datasetReadinessSummary.status}
                    </span>
                  </div>

                  <p>{datasetReadinessSummary.summary}</p>

                  <div className="info-grid">
                    <InfoItem
                      label="Raster files"
                      value={String(datasetReadinessSummary.raster_count)}
                    />
                    <InfoItem
                      label="Vector files"
                      value={String(datasetReadinessSummary.vector_count)}
                    />
                    <InfoItem
                      label="Supporting files"
                      value={String(datasetReadinessSummary.supporting_file_count)}
                    />
                    <InfoItem
                      label="Unsupported files"
                      value={String(datasetReadinessSummary.unsupported_file_count)}
                    />
                  </div>

                  <h5>Dataset Issues</h5>

                  {datasetReadinessSummary.issues.length === 0 ? (
                    <p className="muted-text">
                      No dataset-level issues detected.
                    </p>
                  ) : (
                    <ul>
                      {datasetReadinessSummary.issues.map((issue, index) => (
                        <li key={`dataset-issue-${index}`}>{issue}</li>
                      ))}
                    </ul>
                  )}

                  <h5>Dataset Recommended Actions</h5>

                  <ul>
                    {datasetReadinessSummary.recommended_actions.map(
                      (action, index) => (
                        <li key={`dataset-action-${index}`}>{action}</li>
                      ),
                    )}
                  </ul>
                </>
              )}

              <h4>Files in Session</h4>

              <ul>
                {datasetSession.files.map((file, index) => (
                  <li key={`${file.saved_filename}-${index}`}>
                    <strong>{file.original_filename}</strong> —{" "}
                    {file.file_category} — {file.readiness_status ?? "unknown"}{" "}
                    {file.readiness_score !== null &&
                    file.readiness_score !== undefined
                      ? `(${file.readiness_score}/100)`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {uploadResult.gis_metadata && (
            <div className="card full-width-card">
              <h3>GIS Metadata</h3>

              <pre className="metadata-box">
                {JSON.stringify(uploadResult.gis_metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type InfoItemProps = {
  label: string;
  value: string;
};

function InfoItem({ label, value }: InfoItemProps) {
  return (
    <div className="info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default FileUpload;
