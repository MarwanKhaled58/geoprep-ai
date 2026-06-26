import { useState } from "react";
import {
  uploadFile,
  uploadFiles,
  type BatchUploadResponse,
  type UploadResponse,
} from "../api/uploadApi";

function FileUpload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchUploadResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [datasetSessionId, setDatasetSessionId] = useState<string | undefined>();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.target.files ?? []);

    setSelectedFiles(files);
    setUploadResult(null);
    setBatchResult(null);
    setError("");
  }

  async function handleUpload(): Promise<void> {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file first.");
      return;
    }

    try {
      setIsUploading(true);
      setError("");
      setUploadResult(null);
      setBatchResult(null);

      if (selectedFiles.length === 1) {
        const result = await uploadFile(selectedFiles[0], datasetSessionId);

        if (result.dataset_session_id) {
          setDatasetSessionId(result.dataset_session_id);
        }

        setUploadResult(result);
        return;
      }

      const result = await uploadFiles(selectedFiles, datasetSessionId);

      if (result.dataset_session_id) {
        setDatasetSessionId(result.dataset_session_id);
      }

      setBatchResult(result);
      setUploadResult(result.uploads[result.uploads.length - 1] ?? null);
    } catch (err) {
      setUploadResult(null);
      setBatchResult(null);
      setError(err instanceof Error ? err.message : "Unknown upload error");
    } finally {
      setIsUploading(false);
    }
  }

  const allUploadResults = batchResult?.uploads ?? (uploadResult ? [uploadResult] : []);

  const warnings = uploadResult?.warnings ?? [];
  const readinessReport = uploadResult?.readiness_report;
  const datasetSession =
    batchResult?.dataset_session ?? uploadResult?.dataset_session;
  const datasetReadinessSummary = datasetSession?.readiness_summary;

  return (
    <section className="upload-section">
      <div className="card">
        <h2>Upload GIS Files</h2>

        <p className="section-description">
          Upload raster, vector, image, document, or supporting dataset files.
          GeoPrep AI will classify them, inspect GIS metadata when possible, and
          generate warnings and readiness feedback.
        </p>

        <div className="upload-controls">
          <input type="file" multiple onChange={handleFileChange} />

          <button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload File(s)"}
          </button>
        </div>

        {selectedFiles.length > 0 && (
          <div className="selected-file">
            <p>
              Selected files: <strong>{selectedFiles.length}</strong>
            </p>

            <ul>
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
      </div>

      {batchResult && (
        <div className="card">
          <h3>Batch Upload Summary</h3>

          <p>{batchResult.message}</p>

          <div className="info-grid">
            <InfoItem label="Uploaded files" value={String(batchResult.file_count)} />
            <InfoItem label="Dataset session" value={batchResult.dataset_session_id} />
            <InfoItem
              label="Dataset file count"
              value={String(batchResult.dataset_session.file_count)}
            />
            <InfoItem
              label="Dataset status"
              value={batchResult.dataset_session.readiness_summary?.status ?? "unknown"}
            />
          </div>
        </div>
      )}

      {allUploadResults.length > 0 && (
        <div className="card full-width-card">
          <h3>Uploaded File Results</h3>

          <div className="file-results-table-wrapper">
            <table className="file-results-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Category</th>
                  <th>GIS Type</th>
                  <th>Readiness</th>
                  <th>Status</th>
                  <th>Warnings</th>
                </tr>
              </thead>

              <tbody>
                {allUploadResults.map((result) => {
                  const gisType =
                    typeof result.gis_metadata?.gis_type === "string"
                      ? result.gis_metadata.gis_type
                      : "non-gis";

                  const readinessScore =
                    result.readiness_report?.readiness_score ?? null;

                  const readinessStatus =
                    result.readiness_report?.status ?? "unknown";

                  const warningCount = result.warnings?.length ?? 0;

                  return (
                    <tr key={result.saved_filename}>
                      <td>
                        <strong>{result.original_filename}</strong>
                      </td>
                      <td>{result.file_category}</td>
                      <td>{gisType}</td>
                      <td>
                        {readinessScore !== null
                          ? `${readinessScore}/100`
                          : "N/A"}
                      </td>
                      <td>
                        <span className={`status-pill status-${readinessStatus}`}>
                          {readinessStatus}
                        </span>
                      </td>
                      <td>{warningCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {uploadResult && (
        <div className="results-grid">
          <div className="card">
            <h3>Latest File Summary</h3>

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
                <h3>Latest File Readiness Report</h3>

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
            <h3>Latest File Warnings</h3>

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
              <h3>Latest File GIS Metadata</h3>

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
