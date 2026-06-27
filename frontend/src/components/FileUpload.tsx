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
  const crsSummary = datasetReadinessSummary?.crs_summary;
  const crsResolutionGuidanceSummary =
    datasetReadinessSummary?.crs_resolution_guidance_summary;
  const preparationPlanSummary =
    datasetReadinessSummary?.preparation_plan_summary;
  const boundsSummary = datasetReadinessSummary?.bounds_summary;
  const rasterVectorRelationshipSummary =
    datasetReadinessSummary?.raster_vector_relationship_summary;
  const taskRecommendationSummary =
    datasetReadinessSummary?.task_recommendation_summary;

  return (
    <section className="upload-section">
      <div className="hero-card">
        <div>
          <p className="eyebrow">GeoAI Dataset Preparation</p>
          <h2>Upload Dataset Files</h2>
          <p className="section-description">
            Upload raster, vector, image, document, or supporting dataset files.
            GeoPrep AI will classify them, inspect GIS metadata when possible,
            analyze readiness, compare CRS, provide CRS resolution guidance,
            review bounds, detect raster-vector relationships, recommend GeoAI
            tasks, generate a preparation plan, and recommend next actions.
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

          {crsSummary && (
            <div className="crs-review-box">
              <div className="card-header-row">
                <div>
                  <h4>CRS Review</h4>
                  <p className="small-muted">
                    Spatial CRS comparison across raster and vector files.
                  </p>
                </div>

                <span className={`status-pill status-${crsSummary.status}`}>
                  {crsSummary.status}
                </span>
              </div>

              <p>{crsSummary.summary}</p>

              <div className="info-grid compact-grid">
                <InfoItem
                  label="Spatial files"
                  value={String(crsSummary.spatial_file_count)}
                />
                <InfoItem
                  label="CRS groups"
                  value={String(crsSummary.crs_groups.length)}
                />
                <InfoItem
                  label="Missing CRS"
                  value={String(crsSummary.files_missing_crs.length)}
                />
                <InfoItem
                  label="Unresolved CRS"
                  value={String(crsSummary.files_with_unresolved_crs.length)}
                />
              </div>

              {crsSummary.crs_groups.length > 0 && (
                <>
                  <h5>CRS Groups</h5>

                  <ul className="clean-list">
                    {crsSummary.crs_groups.map((group, index) => (
                      <li key={`crs-group-${index}`}>
                        <strong>{formatCrsLabel(group.crs_label)}</strong> —{" "}
                        {group.file_count} file(s):{" "}
                        {group.filenames.join(", ")}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {crsSummary.files_missing_crs.length > 0 && (
                <>
                  <h5>Files Missing CRS</h5>

                  <ul className="clean-list">
                    {crsSummary.files_missing_crs.map((filename) => (
                      <li key={`missing-crs-${filename}`}>{filename}</li>
                    ))}
                  </ul>
                </>
              )}

              {crsSummary.files_with_unresolved_crs.length > 0 && (
                <>
                  <h5>Files With Unresolved CRS</h5>

                  <ul className="clean-list">
                    {crsSummary.files_with_unresolved_crs.map((filename) => (
                      <li key={`unresolved-crs-${filename}`}>{filename}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {crsResolutionGuidanceSummary && (
            <div className="crs-guidance-box">
              <div className="card-header-row">
                <div>
                  <h4>CRS Resolution Guidance</h4>
                  <p className="small-muted">
                    Recommended CRS target and per-file reprojection guidance.
                  </p>
                </div>

                <span
                  className={`status-pill status-${crsResolutionGuidanceSummary.status}`}
                >
                  {formatCodeValue(crsResolutionGuidanceSummary.status)}
                </span>
              </div>

              <p>{crsResolutionGuidanceSummary.summary}</p>

              <div className="info-grid compact-grid">
                <InfoItem
                  label="Recommended target CRS"
                  value={
                    crsResolutionGuidanceSummary.recommended_target_crs ??
                    "Not inferred"
                  }
                />
                <InfoItem
                  label="Recommended EPSG"
                  value={
                    crsResolutionGuidanceSummary.recommended_target_epsg !== null
                      ? String(crsResolutionGuidanceSummary.recommended_target_epsg)
                      : "Not inferred"
                  }
                />
                <InfoItem
                  label="Files needing guidance"
                  value={String(
                    crsResolutionGuidanceSummary.file_guidance.length,
                  )}
                />
                <InfoItem
                  label="Guidance status"
                  value={formatCodeValue(crsResolutionGuidanceSummary.status)}
                />
              </div>

              {crsResolutionGuidanceSummary.file_guidance.length > 0 && (
                <>
                  <h5>Per-File CRS Guidance</h5>

                  <ul className="clean-list">
                    {crsResolutionGuidanceSummary.file_guidance.map(
                      (item, index) => (
                        <li key={`crs-guidance-${index}`}>
                          <strong>{item.filename}</strong> —{" "}
                          {formatCodeValue(item.status)}
                          {item.detected_crs ? ` — ${item.detected_crs}` : ""}.{" "}
                          {item.recommended_action}
                        </li>
                      ),
                    )}
                  </ul>
                </>
              )}

              {crsResolutionGuidanceSummary.recommended_actions.length > 0 && (
                <>
                  <h5>CRS Resolution Actions</h5>

                  <ul className="clean-list">
                    {crsResolutionGuidanceSummary.recommended_actions.map(
                      (action, index) => (
                        <li key={`crs-guidance-action-${index}`}>{action}</li>
                      ),
                    )}
                  </ul>
                </>
              )}
            </div>
          )}

          {boundsSummary && (
            <div className="bounds-review-box">
              <div className="card-header-row">
                <div>
                  <h4>Bounds Review</h4>
                  <p className="small-muted">
                    Spatial bounds and overlap readiness across raster and
                    vector files.
                  </p>
                </div>

                <span className={`status-pill status-${boundsSummary.status}`}>
                  {boundsSummary.status}
                </span>
              </div>

              <p>{boundsSummary.summary}</p>

              <div className="info-grid compact-grid">
                <InfoItem
                  label="Spatial files"
                  value={String(boundsSummary.spatial_file_count)}
                />
                <InfoItem
                  label="Missing bounds"
                  value={String(boundsSummary.files_missing_bounds.length)}
                />
                <InfoItem
                  label="Bounds pairs"
                  value={String(boundsSummary.bounds_pairs.length)}
                />
                <InfoItem
                  label="Overlapping pairs"
                  value={String(
                    boundsSummary.bounds_pairs.filter((pair) => pair.overlaps)
                      .length,
                  )}
                />
              </div>

              {boundsSummary.bounds_pairs.length > 0 && (
                <>
                  <h5>Bounds Pairs</h5>

                  <ul className="clean-list">
                    {boundsSummary.bounds_pairs.map((pair, index) => (
                      <li key={`bounds-pair-${index}`}>
                        <strong>{pair.first_file}</strong> ↔{" "}
                        <strong>{pair.second_file}</strong> —{" "}
                        {pair.overlaps ? "overlaps" : "does not overlap"}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {boundsSummary.files_missing_bounds.length > 0 && (
                <>
                  <h5>Files Missing Bounds</h5>

                  <ul className="clean-list">
                    {boundsSummary.files_missing_bounds.map((filename) => (
                      <li key={`missing-bounds-${filename}`}>{filename}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {rasterVectorRelationshipSummary && (
            <div className="relationship-review-box">
              <div className="card-header-row">
                <div>
                  <h4>Raster-Vector Relationship</h4>
                  <p className="small-muted">
                    GeoAI readiness relationship between imagery and vector
                    data.
                  </p>
                </div>

                <span
                  className={`status-pill status-${rasterVectorRelationshipSummary.status}`}
                >
                  {rasterVectorRelationshipSummary.status}
                </span>
              </div>

              <p>{rasterVectorRelationshipSummary.summary}</p>

              <div className="info-grid compact-grid">
                <InfoItem
                  label="Raster files"
                  value={String(
                    rasterVectorRelationshipSummary.raster_file_count,
                  )}
                />
                <InfoItem
                  label="Vector files"
                  value={String(
                    rasterVectorRelationshipSummary.vector_file_count,
                  )}
                />
                <InfoItem
                  label="Relationship type"
                  value={formatCodeValue(
                    rasterVectorRelationshipSummary.relationship_type,
                  )}
                />
                <InfoItem
                  label="Vector role"
                  value={formatCodeValue(
                    rasterVectorRelationshipSummary.vector_role,
                  )}
                />
              </div>

              {rasterVectorRelationshipSummary.issues.length > 0 && (
                <>
                  <h5>Relationship Issues</h5>

                  <ul className="clean-list">
                    {rasterVectorRelationshipSummary.issues.map(
                      (issue, index) => (
                        <li key={`relationship-issue-${index}`}>{issue}</li>
                      ),
                    )}
                  </ul>
                </>
              )}

              {rasterVectorRelationshipSummary.recommended_actions.length >
                0 && (
                <>
                  <h5>Relationship Recommended Actions</h5>

                  <ul className="clean-list">
                    {rasterVectorRelationshipSummary.recommended_actions.map(
                      (action, index) => (
                        <li key={`relationship-action-${index}`}>{action}</li>
                      ),
                    )}
                  </ul>
                </>
              )}
            </div>
          )}

          {taskRecommendationSummary && (
            <div className="task-recommendation-box">
              <div className="card-header-row">
                <div>
                  <h4>Dataset Task Recommendation</h4>
                  <p className="small-muted">
                    Suggested GeoAI task based on dataset composition, CRS,
                    bounds, and raster-vector relationship.
                  </p>
                </div>

                <span
                  className={`status-pill status-${taskRecommendationSummary.status}`}
                >
                  {taskRecommendationSummary.status}
                </span>
              </div>

              <p>{taskRecommendationSummary.summary}</p>

              <div className="info-grid compact-grid">
                <InfoItem
                  label="Recommended task"
                  value={formatCodeValue(
                    taskRecommendationSummary.recommended_task,
                  )}
                />
                <InfoItem
                  label="Confidence"
                  value={formatCodeValue(taskRecommendationSummary.confidence)}
                />
                <InfoItem
                  label="Blockers"
                  value={
                    taskRecommendationSummary.blockers.length > 0
                      ? formatCodeList(taskRecommendationSummary.blockers)
                      : "None"
                  }
                />
                <InfoItem
                  label="Task status"
                  value={formatCodeValue(taskRecommendationSummary.status)}
                />
              </div>

              {taskRecommendationSummary.issues.length > 0 && (
                <>
                  <h5>Task Recommendation Issues</h5>

                  <ul className="clean-list">
                    {taskRecommendationSummary.issues.map((issue, index) => (
                      <li key={`task-issue-${index}`}>{issue}</li>
                    ))}
                  </ul>
                </>
              )}

              {taskRecommendationSummary.recommended_actions.length > 0 && (
                <>
                  <h5>Task Recommended Actions</h5>

                  <ul className="clean-list">
                    {taskRecommendationSummary.recommended_actions.map(
                      (action, index) => (
                        <li key={`task-action-${index}`}>{action}</li>
                      ),
                    )}
                  </ul>
                </>
              )}
            </div>
          )}

          {preparationPlanSummary && (
            <div className="preparation-plan-box">
              <div className="card-header-row">
                <div>
                  <h4>Dataset Preparation Plan</h4>
                  <p className="small-muted">
                    Ordered workflow for preparing this dataset for GeoAI use.
                  </p>
                </div>

                <span
                  className={`status-pill status-${preparationPlanSummary.status}`}
                >
                  {formatCodeValue(preparationPlanSummary.status)}
                </span>
              </div>

              <p>{preparationPlanSummary.summary}</p>

              <div className="info-grid compact-grid">
                <InfoItem
                  label="Plan status"
                  value={formatCodeValue(preparationPlanSummary.status)}
                />
                <InfoItem
                  label="Step count"
                  value={String(preparationPlanSummary.steps.length)}
                />
                <InfoItem
                  label="Blockers"
                  value={
                    preparationPlanSummary.blockers.length > 0
                      ? formatCodeList(preparationPlanSummary.blockers)
                      : "None"
                  }
                />
                <InfoItem
                  label="First step"
                  value={
                    preparationPlanSummary.steps.length > 0
                      ? preparationPlanSummary.steps[0].title
                      : "Not available"
                  }
                />
              </div>

              {preparationPlanSummary.steps.length > 0 && (
                <>
                  <h5>Preparation Steps</h5>

                  <div className="plan-step-list">
                    {preparationPlanSummary.steps.map((step) => (
                      <div
                        className="plan-step-card"
                        key={`plan-step-${step.order}`}
                      >
                        <div className="plan-step-header">
                          <span className="plan-step-number">
                            Step {step.order}
                          </span>
                          <span className={`status-pill status-${step.status}`}>
                            {formatCodeValue(step.status)}
                          </span>
                        </div>

                        <h5>{step.title}</h5>
                        <p>{step.description}</p>

                        <p className="expected-result">
                          Expected result: {step.expected_result}
                        </p>

                        {step.actions.length > 0 && (
                          <ul className="clean-list">
                            {step.actions.map((action, index) => (
                              <li
                                key={`plan-step-${step.order}-action-${index}`}
                              >
                                {action}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {preparationPlanSummary.recommended_actions.length > 0 && (
                <>
                  <h5>Plan Recommended Actions</h5>

                  <ul className="clean-list">
                    {preparationPlanSummary.recommended_actions.map(
                      (action, index) => (
                        <li key={`plan-action-${index}`}>{action}</li>
                      ),
                    )}
                  </ul>
                </>
              )}
            </div>
          )}

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

        <span className="small-muted">{warnings.length} warning(s)</span>
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

function formatCodeValue(value: string): string {
  return value.replaceAll("_", " ");
}

function formatCodeList(values: string[]): string {
  return values.map((value) => formatCodeValue(value)).join(", ");
}

function formatCrsLabel(crsLabel: string): string {
  if (crsLabel.startsWith("EPSG:")) {
    return crsLabel;
  }

  const projectedNameMatch = crsLabel.match(/PROJCS\["([^"]+)"/);

  if (projectedNameMatch?.[1]) {
    return projectedNameMatch[1];
  }

  const geographicNameMatch = crsLabel.match(/GEOGCS\["([^"]+)"/);

  if (geographicNameMatch?.[1]) {
    return geographicNameMatch[1];
  }

  if (crsLabel.length > 80) {
    return `${crsLabel.slice(0, 80)}...`;
  }

  return crsLabel;
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
          ? formatCrsLabel(crs.crs_text)
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
