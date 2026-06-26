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
  const [batchResult, setBatchResult] = useState<BatchUploadResponse | null>(
    null,
  );
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

  const allUploadResults =
    batchResult?.uploads ?? (uploadResult ? [uploadResult] : []);

  const datasetSession =
    batchResult?.dataset_session ?? uploadResult?.dataset_session;

  const datasetReadinessSummary = datasetSession?.readiness_summary;

  return (
    <section className="upload-section">
      <div className="hero-card">
        <div>
          <p className="eyebrow">GeoAI Dataset Preparation</p>
          <h2>Upload Dataset Files</h2>
          <p className="section-description">
            Upload raster, vector, image, document, or supporting dataset files.
            GeoPrep AI will classify them, inspect GIS metadata when possible,
            analyze readiness, and recommend next actions.
          </p>
        </div>

        <div className="upload-panel">
          <input type="file" multiple onChange={handleFileChange} />

          <button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? "Analyzing..." : "Analyze Dataset"}
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
            <InfoItem
              label="Uploaded files"
              value={String(batchResult.file_count)}
            />
            <InfoItem
              label="Dataset session"
              value={batchResult.dataset_session_id}
            />
            <InfoItem
              label="Dataset file count"
              value={String(batchResult.dataset_session.file_count)}
            />
            <InfoItem
              label="Dataset status"
              value={
                batchResult.dataset_session.readiness_summary?.status ??
                "unknown"
              }
            />
          </div>
        </div>
      )}

      {datasetSession && datasetReadinessSummary && (
        <div className="report-card dataset-report">
          <div className="report-header">
            <div>
              <p className="eyebrow">Dataset Final Report</p>
              <h3>Dataset Readiness Summary</h3>
            </div>

            <span
              className={`status-pill status-${datasetReadinessSummary.status}`}
            >
              {datasetReadinessSummary.status}
            </span>
          </div>

          <div className="report-main">
            <div className="score-box large-score">
              <span className="score-number">
                {datasetReadinessSummary.readiness_score}
              </span>
              <span className="score-total">/100</span>
            </div>

            <div>
              <p className="report-summary">
                {datasetReadinessSummary.summary}
              </p>

              <div className="info-grid compact-grid">
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
            </div>
          </div>

          <div className="report-columns">
            <div>
              <h4>Dataset Issues</h4>

              {datasetReadinessSummary.issues.length === 0 ? (
                <p className="success-text">
                  No dataset-level issues detected.
                </p>
              ) : (
                <ul className="clean-list">
                  {datasetReadinessSummary.issues.map((issue, index) => (
                    <li key={`dataset-issue-${index}`}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4>Recommended Next Actions</h4>

              <ul className="clean-list">
                {datasetReadinessSummary.recommended_actions.map(
                  (action, index) => (
                    <li key={`dataset-action-${index}`}>{action}</li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {allUploadResults.length > 0 && (
        <div className="card full-width-card">
          <div className="card-header-row">
            <h3>Uploaded Files Overview</h3>
            <span className="small-muted">
              {allUploadResults.length} file(s)
            </span>
          </div>

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
                  const gisType = getGisType(result);
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

      {allUploadResults.length > 0 && (
        <div className="file-report-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">File-Level Analysis</p>
              <h3>Detailed File Reports</h3>
            </div>
          </div>

          <div className="file-report-grid">
            {allUploadResults.map((result) => (
              <FileReportCard key={result.saved_filename} result={result} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

type FileReportCardProps = {
  result: UploadResponse;
};

function FileReportCard({ result }: FileReportCardProps) {
  const warnings = result.warnings ?? [];
  const readinessReport = result.readiness_report;
  const gisType = getGisType(result);

  return (
    <div className="card file-report-card">
      <div className="card-header-row">
        <div>
          <h4>{result.original_filename}</h4>
          <p className="small-muted">
            {result.file_category} · {gisType}
          </p>
        </div>

        {readinessReport && (
          <span className={`status-pill status-${readinessReport.status}`}>
            {readinessReport.status}
          </span>
        )}
      </div>

      <div className="mini-score-row">
        <div>
          <span className="mini-score">
            {readinessReport?.readiness_score ?? "N/A"}
          </span>
          {readinessReport && <span className="score-total">/100</span>}
        </div>

        <span className="small-muted">
          {warnings.length} warning(s)
        </span>
      </div>

      {readinessReport && (
        <>
          <p>{readinessReport.summary}</p>

          <h5>File Issues</h5>
          {readinessReport.issues.length === 0 ? (
            <p className="success-text">No readiness issues detected.</p>
          ) : (
            <ul className="clean-list">
              {readinessReport.issues.map((issue, index) => (
                <li key={`file-issue-${index}`}>{issue}</li>
              ))}
            </ul>
          )}

          <h5>Recommended Actions</h5>
          <ul className="clean-list">
            {readinessReport.recommended_actions.map((action, index) => (
              <li key={`file-action-${index}`}>{action}</li>
            ))}
          </ul>
        </>
      )}

      <h5>Warnings</h5>
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

      <h5>Important Metadata</h5>
      <div className="metadata-summary-grid">
        {getImportantMetadata(result).map((item) => (
          <InfoItem key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      {result.gis_metadata && (
        <details className="raw-metadata-details">
          <summary>View raw metadata</summary>
          <pre className="metadata-box">
            {JSON.stringify(result.gis_metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function getGisType(result: UploadResponse): string {
  const gisType = result.gis_metadata?.gis_type;

  return typeof gisType === "string" && gisType.length > 0
    ? gisType
    : "non-gis";
}

function getImportantMetadata(
  result: UploadResponse,
): Array<{ label: string; value: string }> {
  const metadata = result.gis_metadata?.metadata as Record<string, unknown> | null;
  const crs = result.gis_metadata?.crs as Record<string, unknown> | null;

  const items: Array<{ label: string; value: string }> = [
    {
      label: "CRS",
      value:
        crs && typeof crs.crs_text === "string"
          ? crs.crs_text
          : "Not available",
    },
  ];

  if (!metadata) {
    return [
      ...items,
      {
        label: "Spatial metadata",
        value: "Not available",
      },
    ];
  }

  if (typeof metadata.feature_count === "number") {
    items.push({
      label: "Feature count",
      value: String(metadata.feature_count),
    });
  }

  if (Array.isArray(metadata.geometry_types)) {
    items.push({
      label: "Geometry types",
      value: metadata.geometry_types.join(", "),
    });
  }

  if (typeof metadata.width === "number" && typeof metadata.height === "number") {
    items.push({
      label: "Raster size",
      value: `${metadata.width} × ${metadata.height}`,
    });
  }

  if (typeof metadata.band_count === "number") {
    items.push({
      label: "Band count",
      value: String(metadata.band_count),
    });
  }

  if (metadata.nodata === null) {
    items.push({
      label: "Nodata",
      value: "Not defined",
    });
  }

  return items;
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
