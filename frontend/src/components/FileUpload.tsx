import { useRef, useState } from "react";
import {
  uploadFile,
  uploadFiles,
  type BatchUploadResponse,
  type DatasetReadinessSummary,
  type DatasetSession,
  type UploadResponse,
} from "../api/uploadApi";

function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  function handleStartNewDataset(): void {
    setSelectedFiles([]);
    setUploadResult(null);
    setBatchResult(null);
    setError("");
    setDatasetSessionId(undefined);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

  function handleExportReportJson(): void {
    if (!datasetSession || !datasetReadinessSummary) {
      return;
    }

    const report = {
      export_type: "geoprep_dataset_readiness_report",
      exported_at: new Date().toISOString(),
      dataset_session_id: datasetSession.dataset_session_id,
      dataset_file_count: datasetSession.file_count,
      readiness_summary: datasetReadinessSummary,
      uploaded_files: allUploadResults.map((result) => ({
        original_filename: result.original_filename,
        saved_filename: result.saved_filename,
        file_category: result.file_category,
        gis_type: getGisType(result),
        readiness_status: result.readiness_report?.status ?? null,
        readiness_score: result.readiness_report?.readiness_score ?? null,
        warnings: result.warnings ?? [],
        important_metadata: getImportantMetadata(result),
      })),
    };

    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `geoprep_dataset_report_${datasetSession.dataset_session_id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleExportMarkdownReport(): void {
    if (!datasetSession || !datasetReadinessSummary) {
      return;
    }

    const markdown = buildMarkdownReport({
      datasetSession,
      datasetReadinessSummary,
      correctedValidationSummary,
      allUploadResults,
    });
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `geoprep_dataset_report_${datasetSession.dataset_session_id}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const allUploadResults =
    batchResult?.uploads ?? (uploadResult ? [uploadResult] : []);

  const datasetSession =
    batchResult?.dataset_session ?? uploadResult?.dataset_session;

  const datasetReadinessSummary = datasetSession?.readiness_summary;
  const crsSummary = datasetReadinessSummary?.crs_summary;
  const crsResolutionGuidanceSummary =
    datasetReadinessSummary?.crs_resolution_guidance_summary;
  const crsCorrectionInstructionSummary =
    datasetReadinessSummary?.crs_correction_instruction_summary;
  const preparationPlanSummary =
    datasetReadinessSummary?.preparation_plan_summary;
  const boundsSummary = datasetReadinessSummary?.bounds_summary;
  const rasterVectorRelationshipSummary =
    datasetReadinessSummary?.raster_vector_relationship_summary;
  const taskRecommendationSummary =
    datasetReadinessSummary?.task_recommendation_summary;

  const correctedValidationSummary = buildCorrectedValidationSummary({
    datasetStatus: datasetReadinessSummary?.status,
    crsStatus: crsSummary?.status,
    boundsStatus: boundsSummary?.status,
    relationshipStatus: rasterVectorRelationshipSummary?.status,
    taskStatus: taskRecommendationSummary?.status,
    planStatus: preparationPlanSummary?.status,
  });

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
            generate CRS correction instructions, validate corrected re-uploads,
            review bounds, detect raster-vector relationships, recommend GeoAI
            tasks, generate a preparation plan, and recommend next actions.
          </p>
        </div>

        <div className="upload-panel">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
          />

          <button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? "Analyzing..." : "Analyze Dataset"}
          </button>

          <button
            className="secondary-button"
            onClick={handleStartNewDataset}
            disabled={isUploading}
            type="button"
          >
            Start New Dataset
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

            <div className="report-header-actions">
              <button
                className="secondary-button export-report-button"
                onClick={handleExportReportJson}
                type="button"
              >
                Export Report JSON
              </button>

              <button
                className="secondary-button export-report-button"
                onClick={handleExportMarkdownReport}
                type="button"
              >
                Export Report Markdown
              </button>

              <span
                className={`status-pill status-${datasetReadinessSummary.status}`}
              >
                {datasetReadinessSummary.status}
              </span>
            </div>
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

          {correctedValidationSummary && (
            <div
              className={`corrected-validation-box validation-${correctedValidationSummary.status}`}
            >
              <div className="card-header-row">
                <div>
                  <h4>Corrected Re-upload Validation</h4>
                  <p className="small-muted">
                    Checks whether CRS correction and re-upload solved the
                    dataset blockers.
                  </p>
                </div>

                <span
                  className={`status-pill status-${correctedValidationSummary.status}`}
                >
                  {formatCodeValue(correctedValidationSummary.status)}
                </span>
              </div>

              <p>{correctedValidationSummary.summary}</p>

              <div className="info-grid compact-grid">
                <InfoItem
                  label="CRS"
                  value={formatCodeValue(correctedValidationSummary.crsStatus)}
                />
                <InfoItem
                  label="Bounds"
                  value={formatCodeValue(
                    correctedValidationSummary.boundsStatus,
                  )}
                />
                <InfoItem
                  label="Raster-vector"
                  value={formatCodeValue(
                    correctedValidationSummary.relationshipStatus,
                  )}
                />
                <InfoItem
                  label="Task"
                  value={formatCodeValue(correctedValidationSummary.taskStatus)}
                />
              </div>

              <h5>Validation Checks</h5>

              <ul className="clean-list">
                {correctedValidationSummary.checks.map((check, index) => (
                  <li key={`corrected-validation-check-${index}`}>
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                      ? String(
                          crsResolutionGuidanceSummary.recommended_target_epsg,
                        )
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

          {crsCorrectionInstructionSummary && (
            <div className="crs-correction-box">
              <div className="card-header-row">
                <div>
                  <h4>CRS Correction Instructions</h4>
                  <p className="small-muted">
                    Tool-specific reprojection guidance for ArcGIS Pro, QGIS,
                    and Python.
                  </p>
                </div>

                <span
                  className={`status-pill status-${crsCorrectionInstructionSummary.status}`}
                >
                  {formatCodeValue(crsCorrectionInstructionSummary.status)}
                </span>
              </div>

              <p>{crsCorrectionInstructionSummary.summary}</p>

              <div className="info-grid compact-grid">
                <InfoItem
                  label="Target CRS"
                  value={
                    crsCorrectionInstructionSummary.target_crs ?? "Not inferred"
                  }
                />
                <InfoItem
                  label="Target EPSG"
                  value={
                    crsCorrectionInstructionSummary.target_epsg !== null
                      ? String(crsCorrectionInstructionSummary.target_epsg)
                      : "Not inferred"
                  }
                />
                <InfoItem
                  label="Files to reproject"
                  value={String(
                    crsCorrectionInstructionSummary.files_to_reproject.length,
                  )}
                />
                <InfoItem
                  label="Files to confirm"
                  value={String(
                    crsCorrectionInstructionSummary.files_to_confirm.length,
                  )}
                />
              </div>

              {crsCorrectionInstructionSummary.files_to_reproject.length > 0 && (
                <>
                  <h5>Files To Reproject</h5>

                  <ul className="clean-list">
                    {crsCorrectionInstructionSummary.files_to_reproject.map(
                      (item, index) => (
                        <li key={`crs-reproject-${index}`}>
                          <strong>{item.filename}</strong> — {item.source_crs} →{" "}
                          {item.target_crs}. {item.reason}
                        </li>
                      ),
                    )}
                  </ul>
                </>
              )}

              {crsCorrectionInstructionSummary.files_to_confirm.length > 0 && (
                <>
                  <h5>Files To Confirm</h5>

                  <ul className="clean-list">
                    {crsCorrectionInstructionSummary.files_to_confirm.map(
                      (item, index) => (
                        <li key={`crs-confirm-${index}`}>
                          <strong>{item.filename}</strong> —{" "}
                          {item.detected_crs ??
                            item.recommended_crs ??
                            "Unknown CRS"}
                          . {item.reason}
                        </li>
                      ),
                    )}
                  </ul>
                </>
              )}

              <div className="tool-instruction-grid">
                <ToolInstructionCard
                  title="ArcGIS Pro"
                  steps={crsCorrectionInstructionSummary.arcgis_pro_steps}
                />
                <ToolInstructionCard
                  title="QGIS"
                  steps={crsCorrectionInstructionSummary.qgis_steps}
                />
                <ToolInstructionCard
                  title="Python / GeoPandas"
                  steps={crsCorrectionInstructionSummary.python_steps}
                />
              </div>

              {crsCorrectionInstructionSummary.recommended_actions.length >
                0 && (
                <>
                  <h5>CRS Correction Actions</h5>

                  <ul className="clean-list">
                    {crsCorrectionInstructionSummary.recommended_actions.map(
                      (action, index) => (
                        <li key={`crs-correction-action-${index}`}>
                          {action}
                        </li>
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
                  label="First actionable step"
                  value={getFirstActionableStepTitle(
                    preparationPlanSummary.steps,
                  )}
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

type MarkdownReportInput = {
  datasetSession: DatasetSession;
  datasetReadinessSummary: DatasetReadinessSummary;
  correctedValidationSummary: CorrectedValidationSummary | null;
  allUploadResults: UploadResponse[];
};

function buildMarkdownReport({
  datasetSession,
  datasetReadinessSummary,
  correctedValidationSummary,
  allUploadResults,
}: MarkdownReportInput): string {
  const crsSummary = datasetReadinessSummary.crs_summary;
  const crsResolutionGuidanceSummary =
    datasetReadinessSummary.crs_resolution_guidance_summary;
  const crsCorrectionInstructionSummary =
    datasetReadinessSummary.crs_correction_instruction_summary;
  const boundsSummary = datasetReadinessSummary.bounds_summary;
  const rasterVectorRelationshipSummary =
    datasetReadinessSummary.raster_vector_relationship_summary;
  const taskRecommendationSummary =
    datasetReadinessSummary.task_recommendation_summary;
  const preparationPlanSummary =
    datasetReadinessSummary.preparation_plan_summary;

  const lines: string[] = [
    "# GeoPrep AI Dataset Readiness Report",
    "",
    "## Report Metadata",
    `- Exported at: ${formatMarkdownValue(new Date().toISOString())}`,
    `- Dataset session ID: ${formatMarkdownValue(datasetSession.dataset_session_id)}`,
    `- Dataset file count: ${formatMarkdownValue(datasetSession.file_count)}`,
    "",
    "## Dataset Readiness Summary",
    `- Status: ${formatMarkdownValue(datasetReadinessSummary.status)}`,
    `- Readiness score: ${formatMarkdownValue(datasetReadinessSummary.readiness_score)}/100`,
    `- Summary: ${formatMarkdownValue(datasetReadinessSummary.summary)}`,
    `- Raster files: ${formatMarkdownValue(datasetReadinessSummary.raster_count)}`,
    `- Vector files: ${formatMarkdownValue(datasetReadinessSummary.vector_count)}`,
    `- Supporting files: ${formatMarkdownValue(datasetReadinessSummary.supporting_file_count)}`,
    `- Unsupported files: ${formatMarkdownValue(datasetReadinessSummary.unsupported_file_count)}`,
    "",
    "## Dataset Issues",
    formatMarkdownList(
      datasetReadinessSummary.issues,
      "No dataset-level issues detected.",
    ),
    "",
    "## Recommended Next Actions",
    formatMarkdownList(
      datasetReadinessSummary.recommended_actions,
      "No immediate dataset-level actions required.",
    ),
    "",
    "## Corrected Re-upload Validation",
  ];

  if (correctedValidationSummary) {
    lines.push(
      `- Status: ${formatMarkdownValue(correctedValidationSummary.status)}`,
      `- Message: ${formatMarkdownValue(correctedValidationSummary.summary)}`,
      `- CRS: ${formatMarkdownValue(correctedValidationSummary.crsStatus)}`,
      `- Bounds: ${formatMarkdownValue(correctedValidationSummary.boundsStatus)}`,
      `- Raster-vector: ${formatMarkdownValue(correctedValidationSummary.relationshipStatus)}`,
      `- Task: ${formatMarkdownValue(correctedValidationSummary.taskStatus)}`,
      "",
      "### Validation Checks",
      formatMarkdownList(correctedValidationSummary.checks, "No validation checks available."),
    );
  } else {
    lines.push("No corrected re-upload validation summary is available.");
  }

  lines.push("", "## CRS Review");

  if (crsSummary) {
    lines.push(
      `- Status: ${formatMarkdownValue(crsSummary.status)}`,
      `- Summary: ${formatMarkdownValue(crsSummary.summary)}`,
      "",
      "### CRS Groups",
      crsSummary.crs_groups.length > 0
        ? crsSummary.crs_groups
            .map(
              (group) =>
                `- ${formatMarkdownValue(group.crs_label)} (${formatMarkdownValue(group.file_count)} file(s)): ${formatMarkdownValue(group.filenames.join(", "))}`,
            )
            .join("\n")
        : "- No CRS groups available.",
      "",
      "### CRS Issues",
      formatMarkdownList(crsSummary.issues, "No CRS issues detected."),
      "",
      "### CRS Recommended Actions",
      formatMarkdownList(crsSummary.recommended_actions, "No CRS actions required."),
    );
  } else {
    lines.push("No CRS review is available.");
  }

  lines.push("", "## CRS Resolution Guidance");

  if (crsResolutionGuidanceSummary) {
    lines.push(
      `- Status: ${formatMarkdownValue(crsResolutionGuidanceSummary.status)}`,
      `- Recommended target CRS: ${formatMarkdownValue(crsResolutionGuidanceSummary.recommended_target_crs)}`,
      `- Recommended EPSG: ${formatMarkdownValue(crsResolutionGuidanceSummary.recommended_target_epsg)}`,
      "",
      "### Per-file CRS Guidance",
      crsResolutionGuidanceSummary.file_guidance.length > 0
        ? crsResolutionGuidanceSummary.file_guidance
            .map(
              (item) =>
                `- ${formatMarkdownValue(item.filename)}: ${formatMarkdownValue(item.status)}; detected CRS: ${formatMarkdownValue(item.detected_crs)}; action: ${formatMarkdownValue(item.recommended_action)}`,
            )
            .join("\n")
        : "- No per-file CRS guidance available.",
      "",
      "### CRS Resolution Recommended Actions",
      formatMarkdownList(
        crsResolutionGuidanceSummary.recommended_actions,
        "No CRS resolution actions required.",
      ),
    );
  } else {
    lines.push("No CRS resolution guidance is available.");
  }

  lines.push("", "## CRS Correction Instructions");

  if (crsCorrectionInstructionSummary) {
    lines.push(
      `- Status: ${formatMarkdownValue(crsCorrectionInstructionSummary.status)}`,
      `- Target CRS: ${formatMarkdownValue(crsCorrectionInstructionSummary.target_crs)}`,
      `- Target EPSG: ${formatMarkdownValue(crsCorrectionInstructionSummary.target_epsg)}`,
      "",
      "### Files To Reproject",
      formatInstructionItems(
        crsCorrectionInstructionSummary.files_to_reproject,
        "No files need reprojection.",
      ),
      "",
      "### Files To Confirm",
      formatInstructionItems(
        crsCorrectionInstructionSummary.files_to_confirm,
        "No files need CRS confirmation.",
      ),
      "",
      "### ArcGIS Pro Steps",
      formatMarkdownList(
        crsCorrectionInstructionSummary.arcgis_pro_steps,
        "No ArcGIS Pro steps available.",
      ),
      "",
      "### QGIS Steps",
      formatMarkdownList(
        crsCorrectionInstructionSummary.qgis_steps,
        "No QGIS steps available.",
      ),
      "",
      "### Python / GeoPandas Steps",
      formatMarkdownList(
        crsCorrectionInstructionSummary.python_steps,
        "No Python / GeoPandas steps available.",
      ),
      "",
      "### CRS Correction Recommended Actions",
      formatMarkdownList(
        crsCorrectionInstructionSummary.recommended_actions,
        "No CRS correction actions required.",
      ),
    );
  } else {
    lines.push("No CRS correction instructions are available.");
  }

  lines.push("", "## Bounds Review");

  if (boundsSummary) {
    lines.push(
      `- Status: ${formatMarkdownValue(boundsSummary.status)}`,
      `- Summary: ${formatMarkdownValue(boundsSummary.summary)}`,
      "",
      "### Bounds Issues",
      formatMarkdownList(boundsSummary.issues, "No bounds issues detected."),
      "",
      "### Bounds Recommended Actions",
      formatMarkdownList(boundsSummary.recommended_actions, "No bounds actions required."),
    );
  } else {
    lines.push("No bounds review is available.");
  }

  lines.push("", "## Raster-Vector Relationship");

  if (rasterVectorRelationshipSummary) {
    lines.push(
      `- Status: ${formatMarkdownValue(rasterVectorRelationshipSummary.status)}`,
      `- Summary: ${formatMarkdownValue(rasterVectorRelationshipSummary.summary)}`,
      `- Relationship type: ${formatMarkdownValue(rasterVectorRelationshipSummary.relationship_type)}`,
      `- Vector role: ${formatMarkdownValue(rasterVectorRelationshipSummary.vector_role)}`,
      "",
      "### Relationship Issues",
      formatMarkdownList(
        rasterVectorRelationshipSummary.issues,
        "No raster-vector relationship issues detected.",
      ),
      "",
      "### Relationship Recommended Actions",
      formatMarkdownList(
        rasterVectorRelationshipSummary.recommended_actions,
        "No raster-vector relationship actions required.",
      ),
    );
  } else {
    lines.push("No raster-vector relationship review is available.");
  }

  lines.push("", "## Dataset Task Recommendation");

  if (taskRecommendationSummary) {
    lines.push(
      `- Status: ${formatMarkdownValue(taskRecommendationSummary.status)}`,
      `- Recommended task: ${formatMarkdownValue(taskRecommendationSummary.recommended_task)}`,
      `- Confidence: ${formatMarkdownValue(taskRecommendationSummary.confidence)}`,
      `- Blockers: ${formatMarkdownValue(taskRecommendationSummary.blockers)}`,
      `- Summary: ${formatMarkdownValue(taskRecommendationSummary.summary)}`,
      "",
      "### Task Issues",
      formatMarkdownList(taskRecommendationSummary.issues, "No task issues detected."),
      "",
      "### Task Recommended Actions",
      formatMarkdownList(
        taskRecommendationSummary.recommended_actions,
        "No task recommendation actions required.",
      ),
    );
  } else {
    lines.push("No task recommendation is available.");
  }

  lines.push("", "## Dataset Preparation Plan");

  if (preparationPlanSummary) {
    lines.push(
      `- Plan status: ${formatMarkdownValue(preparationPlanSummary.status)}`,
      `- Summary: ${formatMarkdownValue(preparationPlanSummary.summary)}`,
      `- First actionable step: ${formatMarkdownValue(getFirstActionableStepTitle(preparationPlanSummary.steps))}`,
      "",
      "### Preparation Steps",
      preparationPlanSummary.steps.length > 0
        ? preparationPlanSummary.steps
            .map(
              (step) =>
                [
                  `- Step ${formatMarkdownValue(step.order)}: ${formatMarkdownValue(step.title)}`,
                  `  - Status: ${formatMarkdownValue(step.status)}`,
                  `  - Description: ${formatMarkdownValue(step.description)}`,
                  `  - Expected result: ${formatMarkdownValue(step.expected_result)}`,
                  `  - Actions:`,
                  formatNestedMarkdownList(step.actions, "No actions listed."),
                ].join("\n"),
            )
            .join("\n")
        : "- No preparation steps available.",
      "",
      "### Preparation Plan Recommended Actions",
      formatMarkdownList(
        preparationPlanSummary.recommended_actions,
        "No preparation plan actions required.",
      ),
    );
  } else {
    lines.push("No preparation plan is available.");
  }

  lines.push("", "## Uploaded Files Overview");

  if (allUploadResults.length === 0) {
    lines.push("No uploaded file summaries are available.");
  } else {
    lines.push(
      allUploadResults
        .map((result, index) => formatUploadedFileMarkdown(result, index))
        .join("\n\n"),
    );
  }

  return `${lines.join("\n")}\n`;
}

function formatUploadedFileMarkdown(result: UploadResponse, index: number): string {
  const warnings = result.warnings ?? [];
  const warningLines =
    warnings.length > 0
      ? warnings
          .map(
            (warning) =>
              `  - ${formatMarkdownValue(warning.severity)} ${formatMarkdownValue(warning.code)}: ${formatMarkdownValue(warning.message)}${
                warning.recommended_action
                  ? ` Recommended action: ${formatMarkdownValue(warning.recommended_action)}`
                  : ""
              }`,
          )
          .join("\n")
      : "  - No warnings detected.";

  return [
    `### ${index + 1}. ${formatMarkdownValue(result.original_filename)}`,
    `- Original filename: ${formatMarkdownValue(result.original_filename)}`,
    `- Saved filename: ${formatMarkdownValue(result.saved_filename)}`,
    `- File category: ${formatMarkdownValue(result.file_category)}`,
    `- GIS type: ${formatMarkdownValue(getGisType(result))}`,
    `- Readiness status: ${formatMarkdownValue(result.readiness_report?.status)}`,
    `- Readiness score: ${formatMarkdownValue(result.readiness_report?.readiness_score)}`,
    "- Important metadata:",
    formatNestedMetadata(getImportantMetadata(result)),
    "- Warnings:",
    warningLines,
  ].join("\n");
}

function formatInstructionItems(
  items: Array<Record<string, unknown>>,
  emptyText: string,
): string {
  if (items.length === 0) {
    return `- ${emptyText}`;
  }

  return items
    .map((item) => {
      const filename = formatMarkdownValue(item.filename);
      const reason = formatMarkdownValue(item.reason);
      const source = item.source_crs
        ? ` from ${formatMarkdownValue(item.source_crs)}`
        : "";
      const targetValue = item.target_crs ?? item.recommended_crs ?? item.detected_crs;
      const target = targetValue ? ` to/as ${formatMarkdownValue(targetValue)}` : "";

      return `- ${filename}${source}${target}. ${reason}`;
    })
    .join("\n");
}

function formatMarkdownList(items: unknown[] | undefined, emptyText: string): string {
  if (!items || items.length === 0) {
    return `- ${emptyText}`;
  }

  return items.map((item) => `- ${formatMarkdownValue(item)}`).join("\n");
}

function formatNestedMarkdownList(
  items: unknown[] | undefined,
  emptyText: string,
): string {
  if (!items || items.length === 0) {
    return `    - ${emptyText}`;
  }

  return items.map((item) => `    - ${formatMarkdownValue(item)}`).join("\n");
}

function formatNestedMetadata(
  items: Array<{ label: string; value: string }>,
): string {
  if (items.length === 0) {
    return "  - No important metadata available.";
  }

  return items
    .map(
      (item) =>
        `  - ${formatMarkdownValue(item.label)}: ${formatMarkdownValue(item.value)}`,
    )
    .join("\n");
}

function formatMarkdownValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((item) => formatMarkdownValue(item)).join(", ")
      : "None";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value).replace(/\s+/g, " ").trim();
}

type CorrectedValidationInput = {
  datasetStatus?: string;
  crsStatus?: string;
  boundsStatus?: string;
  relationshipStatus?: string;
  taskStatus?: string;
  planStatus?: string;
};

type CorrectedValidationSummary = {
  status: string;
  summary: string;
  crsStatus: string;
  boundsStatus: string;
  relationshipStatus: string;
  taskStatus: string;
  checks: string[];
};

function buildCorrectedValidationSummary({
  datasetStatus,
  crsStatus,
  boundsStatus,
  relationshipStatus,
  taskStatus,
  planStatus,
}: CorrectedValidationInput): CorrectedValidationSummary | null {
  if (!crsStatus || !boundsStatus || !relationshipStatus || !taskStatus) {
    return null;
  }

  const normalizedCrsStatus = crsStatus;
  const normalizedBoundsStatus = boundsStatus;
  const normalizedRelationshipStatus = relationshipStatus;
  const normalizedTaskStatus = taskStatus;
  const normalizedPlanStatus = planStatus ?? "unknown";

  const crsPassed = normalizedCrsStatus === "consistent_crs";
  const boundsPassed = normalizedBoundsStatus === "overlapping_bounds";
  const relationshipPassed =
    normalizedRelationshipStatus === "candidate_geoai_dataset";
  const taskPassed = normalizedTaskStatus === "task_candidate";
  const planPassed = normalizedPlanStatus === "plan_ready";
  const singleFileWorkflow = getSingleFileWorkflowLabel(
    datasetStatus,
    normalizedRelationshipStatus,
  );

  if (crsPassed && singleFileWorkflow) {
    return {
      status: "passed",
      summary:
        `CRS validation passed. This is a ${singleFileWorkflow} workflow, so ` +
        "cross-file bounds and raster-vector relationship checks are not applicable.",
      crsStatus: normalizedCrsStatus,
      boundsStatus: normalizedBoundsStatus,
      relationshipStatus: normalizedRelationshipStatus,
      taskStatus: normalizedTaskStatus,
      checks: [
        "CRS validation passed.",
        "Cross-file bounds validation is not applicable for this workflow.",
        "Raster-vector relationship validation is not applicable for this workflow.",
      ],
    };
  }

  if (crsPassed && boundsPassed && relationshipPassed && taskPassed) {
    return {
      status: "passed",
      summary:
        "Corrected re-upload validation passed. CRS is consistent, bounds overlap, raster-vector relationship is trusted, and a GeoAI task candidate is available.",
      crsStatus: normalizedCrsStatus,
      boundsStatus: normalizedBoundsStatus,
      relationshipStatus: normalizedRelationshipStatus,
      taskStatus: normalizedTaskStatus,
      checks: [
        "CRS validation passed.",
        "Bounds overlap validation passed.",
        "Raster-vector relationship validation passed.",
        "Task recommendation is now a candidate workflow.",
        planPassed
          ? "Preparation plan is ready."
          : "Preparation plan still needs review before export.",
      ],
    };
  }

  if (!crsPassed) {
    return {
      status: "blocked",
      summary:
        "Corrected re-upload validation is still blocked by CRS review. Reproject or confirm CRS, then upload again.",
      crsStatus: normalizedCrsStatus,
      boundsStatus: normalizedBoundsStatus,
      relationshipStatus: normalizedRelationshipStatus,
      taskStatus: normalizedTaskStatus,
      checks: [
        "CRS validation has not passed yet.",
        "Bounds and raster-vector relationship checks should not be trusted until CRS is resolved.",
      ],
    };
  }

  if (!boundsPassed) {
    return {
      status: "needs_review",
      summary:
        "CRS validation passed, but bounds validation still needs review before the dataset can move forward.",
      crsStatus: normalizedCrsStatus,
      boundsStatus: normalizedBoundsStatus,
      relationshipStatus: normalizedRelationshipStatus,
      taskStatus: normalizedTaskStatus,
      checks: [
        "CRS validation passed.",
        "Bounds overlap validation has not fully passed yet.",
        "Review project area, source files, and reprojection outputs.",
      ],
    };
  }

  if (!relationshipPassed) {
    return {
      status: "needs_review",
      summary:
        "CRS and bounds validation passed, but raster-vector relationship still needs review.",
      crsStatus: normalizedCrsStatus,
      boundsStatus: normalizedBoundsStatus,
      relationshipStatus: normalizedRelationshipStatus,
      taskStatus: normalizedTaskStatus,
      checks: [
        "CRS validation passed.",
        "Bounds overlap validation passed.",
        "Raster-vector relationship validation still needs review.",
      ],
    };
  }

  return {
    status: "needs_review",
    summary:
      "Spatial validation passed, but task recommendation or preparation plan still needs review.",
    crsStatus: normalizedCrsStatus,
    boundsStatus: normalizedBoundsStatus,
    relationshipStatus: normalizedRelationshipStatus,
    taskStatus: normalizedTaskStatus,
    checks: [
      "CRS validation passed.",
      "Bounds overlap validation passed.",
      "Raster-vector relationship validation passed.",
      "Task recommendation or preparation plan still needs review.",
    ],
  };
}

function getSingleFileWorkflowLabel(
  datasetStatus: string | undefined,
  relationshipStatus: string,
): string | null {
  if (datasetStatus === "raster_only" || relationshipStatus === "raster_only") {
    return "raster-only";
  }

  if (datasetStatus === "vector_only" || relationshipStatus === "vector_only") {
    return "vector-only";
  }

  return null;
}

function getFirstActionableStepTitle(
  steps: Array<{ title: string; status: string }>,
): string {
  const actionableStep = steps.find((step) =>
    ["required", "blocked", "ready", "planned"].includes(step.status),
  );

  return actionableStep?.title ?? steps[0]?.title ?? "Not available";
}

type ToolInstructionCardProps = {
  title: string;
  steps: string[];
};

function ToolInstructionCard({ title, steps }: ToolInstructionCardProps) {
  return (
    <div className="tool-instruction-card">
      <h5>{title}</h5>

      {steps.length === 0 ? (
        <p className="small-muted">No instructions available.</p>
      ) : (
        <ol className="instruction-list">
          {steps.map((step, index) => (
            <li key={`${title}-instruction-${index}`}>{step}</li>
          ))}
        </ol>
      )}
    </div>
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
