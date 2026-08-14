import {
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import {
  uploadFile,
  uploadFiles,
  type BatchUploadResponse,
  type DatasetReadinessSummary,
  type DatasetSession,
  type UploadResponse,
} from "../api/uploadApi";

const FILE_FILTER_KEYS = {
  ALL: "all",
  RASTER: "raster",
  VECTOR: "vector",
  SUPPORTING: "supporting",
  UNSUPPORTED: "unsupported",
  WARNINGS: "warnings",
} as const;

type FileFilter = (typeof FILE_FILTER_KEYS)[keyof typeof FILE_FILTER_KEYS];

const REPORT_SECTION_KEYS = {
  CORRECTED_VALIDATION: "correctedValidation",
  CRS_REVIEW: "crsReview",
  CRS_GUIDANCE: "crsGuidance",
  CRS_CORRECTION: "crsCorrection",
  BOUNDS_REVIEW: "boundsReview",
  RASTER_VECTOR_RELATIONSHIP: "rasterVectorRelationship",
  TASK_RECOMMENDATION: "taskRecommendation",
  PREPARATION_PLAN: "preparationPlan",
  DATASET_ISSUES: "datasetIssues",
  FILE_RESULTS: "fileResults",
} as const;

type ReportSectionKey =
  (typeof REPORT_SECTION_KEYS)[keyof typeof REPORT_SECTION_KEYS];

const COLLAPSIBLE_REPORT_SECTION_KEYS: ReportSectionKey[] = [
  REPORT_SECTION_KEYS.CORRECTED_VALIDATION,
  REPORT_SECTION_KEYS.CRS_REVIEW,
  REPORT_SECTION_KEYS.CRS_GUIDANCE,
  REPORT_SECTION_KEYS.CRS_CORRECTION,
  REPORT_SECTION_KEYS.BOUNDS_REVIEW,
  REPORT_SECTION_KEYS.RASTER_VECTOR_RELATIONSHIP,
  REPORT_SECTION_KEYS.TASK_RECOMMENDATION,
  REPORT_SECTION_KEYS.PREPARATION_PLAN,
  REPORT_SECTION_KEYS.DATASET_ISSUES,
  REPORT_SECTION_KEYS.FILE_RESULTS,
];

function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const datasetSummaryRef = useRef<HTMLDivElement | null>(null);
  const reportSearchRef = useRef<HTMLDivElement | null>(null);
  const reportPreviewRef = useRef<HTMLDivElement | null>(null);
  const exportPackageReadinessRef = useRef<HTMLDivElement | null>(null);
  const warningSummaryRef = useRef<HTMLDivElement | null>(null);
  const fileOverviewRef = useRef<HTMLDivElement | null>(null);
  const crsCorrectionRef = useRef<HTMLDivElement | null>(null);
  const preparationPlanRef = useRef<HTMLDivElement | null>(null);
  const preparationStepRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reportSectionRefs = useRef<
    Partial<Record<ReportSectionKey, HTMLDivElement | null>>
  >({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchUploadResponse | null>(
    null,
  );
  const [error, setError] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [datasetSessionId, setDatasetSessionId] = useState<string | undefined>();
  const [isSummaryCopied, setIsSummaryCopied] = useState<boolean>(false);
  const [selectedFileFilter, setSelectedFileFilter] =
    useState<FileFilter>(FILE_FILTER_KEYS.ALL);
  const [collapsedSections, setCollapsedSections] = useState<
    Partial<Record<ReportSectionKey, boolean>>
  >({});
  const [reportSearchTerm, setReportSearchTerm] = useState<string>("");

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
    handleSelectFileFilter(FILE_FILTER_KEYS.ALL);

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

        handleSelectFileFilter(FILE_FILTER_KEYS.ALL);
        setUploadResult(result);
        return;
      }

      const result = await uploadFiles(selectedFiles, datasetSessionId);

      if (result.dataset_session_id) {
        setDatasetSessionId(result.dataset_session_id);
      }

      handleSelectFileFilter(FILE_FILTER_KEYS.ALL);
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
      export_package_summary: exportPackageReadiness
        ? buildExportPackageSummary(exportPackageReadiness)
        : null,
      warning_summary: buildWarningSummaryExport(warningSummary),
      uploaded_files: allUploadResults.map((result) => ({
        original_filename: result.original_filename,
        saved_filename: result.saved_filename,
        file_category: result.file_category,
        gis_type: getGisType(result),
        readiness_status: result.readiness_report?.status ?? null,
        readiness_score: result.readiness_report?.readiness_score ?? null,
        warnings: result.warnings ?? [],
        important_metadata: getImportantMetadata(result),
        ...getUploadSourceMetadata(result),
      })),
    };

    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = buildReportDownloadFilename(
      datasetSession,
      datasetReadinessSummary,
      "json",
    );
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
      exportPackageReadiness,
      warningSummary,
    });
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = buildReportDownloadFilename(
      datasetSession,
      datasetReadinessSummary,
      "md",
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopyReportSummary(): Promise<void> {
    if (!datasetSession || !datasetReadinessSummary) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setError("Clipboard copy is not available in this browser.");
      return;
    }

    try {
      const summary = buildPlainTextReportSummary({
        datasetSession,
        datasetReadinessSummary,
        reportQualityBadge,
        allUploadResults,
        exportPackageReadiness,
      });

      await navigator.clipboard.writeText(summary);
      setError("");
      setIsSummaryCopied(true);
      window.setTimeout(() => setIsSummaryCopied(false), 1800);
    } catch {
      setIsSummaryCopied(false);
      setError("Could not copy report summary to clipboard.");
    }
  }

  function handleSelectFileFilter(filter: FileFilter): void {
    setSelectedFileFilter(filter);
  }

  function isSectionCollapsed(sectionKey: ReportSectionKey): boolean {
    return collapsedSections[sectionKey] === true;
  }

  function toggleSection(sectionKey: ReportSectionKey): void {
    setCollapsedSections((currentSections) => ({
      ...currentSections,
      [sectionKey]: !currentSections[sectionKey],
    }));
  }

  function expandSection(sectionKey: ReportSectionKey): void {
    setCollapsedSections((currentSections) => ({
      ...currentSections,
      [sectionKey]: false,
    }));
  }

  function setReportSectionRef(sectionKey: ReportSectionKey) {
    return (element: HTMLDivElement | null) => {
      reportSectionRefs.current[sectionKey] = element;
    };
  }

  function setCrsCorrectionSectionRef(element: HTMLDivElement | null): void {
    crsCorrectionRef.current = element;
    reportSectionRefs.current[REPORT_SECTION_KEYS.CRS_CORRECTION] = element;
  }

  function setPreparationPlanSectionRef(element: HTMLDivElement | null): void {
    preparationPlanRef.current = element;
    reportSectionRefs.current[REPORT_SECTION_KEYS.PREPARATION_PLAN] = element;
  }

  function handleExpandAllReportSections(): void {
    setCollapsedSections({});
  }

  function handleCollapseAllReportSections(): void {
    setCollapsedSections(
      COLLAPSIBLE_REPORT_SECTION_KEYS.reduce<
        Partial<Record<ReportSectionKey, boolean>>
      >((collapsedSectionMap, sectionKey) => {
        collapsedSectionMap[sectionKey] = true;
        return collapsedSectionMap;
      }, {}),
    );
  }

  function handleViewWarningFiles(): void {
    expandSection(REPORT_SECTION_KEYS.FILE_RESULTS);
    handleSelectFileFilter(FILE_FILTER_KEYS.WARNINGS);

    window.setTimeout(() => {
      fileOverviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function handleViewAffectedFiles(): void {
    const hasWarningFiles = allUploadResults.some(
      (result) => (result.warnings?.length ?? 0) > 0,
    );

    expandSection(REPORT_SECTION_KEYS.FILE_RESULTS);

    if (hasWarningFiles) {
      handleSelectFileFilter(FILE_FILTER_KEYS.WARNINGS);
    }

    window.setTimeout(() => {
      fileOverviewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function handleViewCrsCorrectionSteps(): void {
    expandSection(REPORT_SECTION_KEYS.CRS_CORRECTION);
    window.requestAnimationFrame(() => {
      crsCorrectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleViewFirstAction(): void {
    if (!firstActionableStepTitle) {
      handleViewPreparationPlan();
      return;
    }

    expandSection(REPORT_SECTION_KEYS.PREPARATION_PLAN);
    window.requestAnimationFrame(() => {
      const stepRef =
        preparationStepRefs.current[
          normalizeStepTitle(firstActionableStepTitle)
        ];
      const scrollTarget = stepRef ?? preparationPlanRef.current;

      scrollTarget?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleViewPreparationPlan(): void {
    expandSection(REPORT_SECTION_KEYS.PREPARATION_PLAN);
    window.requestAnimationFrame(() => {
      preparationPlanRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleViewExportStep(): void {
    expandSection(REPORT_SECTION_KEYS.PREPARATION_PLAN);
    window.requestAnimationFrame(() => {
      const exportStepTitle = getExportPackageStepTitle(
        preparationPlanSummary?.steps,
      );
      const exportStepRef = exportStepTitle
        ? preparationStepRefs.current[normalizeStepTitle(exportStepTitle)]
        : null;
      const scrollTarget = exportStepRef ?? preparationPlanRef.current;

      scrollTarget?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleViewExportPackageAction(): void {
    if (!exportPackageReadiness) {
      return;
    }

    if (exportPackageReadiness.status === "blocked") {
      handleViewFirstAction();
      return;
    }

    if (exportPackageReadiness.status === "ready") {
      handleViewExportStep();
      return;
    }

    handleViewPreparationPlan();
  }

  function handleReportSearchResultClick(match: ReportSearchMatch): void {
    if (match.sectionKey) {
      expandSection(match.sectionKey);
    }

    window.setTimeout(() => {
      const sectionTarget = match.sectionKey
        ? reportSectionRefs.current[match.sectionKey]
        : null;
      const target =
        sectionTarget ??
        (match.target === "datasetReadiness"
          ? datasetSummaryRef.current
          : warningSummaryRef.current);

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function handleReportNavigationClick(item: ReportNavigationItem): void {
    if (item.sectionKey) {
      expandSection(item.sectionKey);
    }

    window.setTimeout(() => {
      const sectionTarget = item.sectionKey
        ? reportSectionRefs.current[item.sectionKey]
        : null;
      const target = sectionTarget ?? item.targetRef?.current;

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  const allUploadResults =
    batchResult?.uploads ?? (uploadResult ? [uploadResult] : []);
  const fileFilterCounts = getFileFilterCounts(allUploadResults);
  const filteredUploadResults = filterUploadResults(
    allUploadResults,
    selectedFileFilter,
  );
  const warningSummary = buildWarningSummary(allUploadResults);

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
  const reportQualityBadge = datasetReadinessSummary
    ? buildReportQualityBadge(datasetReadinessSummary)
    : null;
  const showCrsCorrectionShortcut = hasCrsBlockingIssue({
    datasetStatus: datasetReadinessSummary?.status,
    crsStatus: crsSummary?.status,
    correctedValidationStatus: correctedValidationSummary?.status,
  });
  const firstActionableStepTitle =
    preparationPlanSummary && preparationPlanSummary.steps.length > 0
      ? getFirstActionableStepTitle(preparationPlanSummary.steps)
      : null;
  const reportSearchMatches =
    datasetSession && datasetReadinessSummary
      ? getReportSearchMatches(
          buildReportSearchIndex({
            allUploadResults,
            correctedValidationSummary,
            datasetReadinessSummary,
            datasetSession,
            warningSummary,
          }),
          reportSearchTerm,
        )
      : [];
  const hasReportSearchTerm = reportSearchTerm.trim().length > 0;
  const reportNavigationItems: ReportNavigationItem[] = [
    { label: "Summary", targetRef: datasetSummaryRef },
    { label: "Search", targetRef: reportSearchRef },
    { label: "Preview", targetRef: reportPreviewRef },
    { label: "Export Package", targetRef: exportPackageReadinessRef },
    { label: "Warnings", targetRef: warningSummaryRef },
    {
      label: "Corrected Validation",
      sectionKey: REPORT_SECTION_KEYS.CORRECTED_VALIDATION,
    },
    { label: "CRS", sectionKey: REPORT_SECTION_KEYS.CRS_REVIEW },
    { label: "CRS Guidance", sectionKey: REPORT_SECTION_KEYS.CRS_GUIDANCE },
    {
      label: "CRS Correction",
      sectionKey: REPORT_SECTION_KEYS.CRS_CORRECTION,
    },
    { label: "Bounds", sectionKey: REPORT_SECTION_KEYS.BOUNDS_REVIEW },
    {
      label: "Raster-Vector",
      sectionKey: REPORT_SECTION_KEYS.RASTER_VECTOR_RELATIONSHIP,
    },
    { label: "Task", sectionKey: REPORT_SECTION_KEYS.TASK_RECOMMENDATION },
    { label: "Plan", sectionKey: REPORT_SECTION_KEYS.PREPARATION_PLAN },
    { label: "Issues", sectionKey: REPORT_SECTION_KEYS.DATASET_ISSUES },
    { label: "Files", sectionKey: REPORT_SECTION_KEYS.FILE_RESULTS },
  ];
  const reportTimelineSteps =
    datasetSession && datasetReadinessSummary
      ? buildReportTimelineSteps(datasetSession, datasetReadinessSummary)
      : [];
  const exportPackageReadiness = datasetReadinessSummary
    ? buildExportPackageReadiness(datasetReadinessSummary, reportTimelineSteps)
    : null;
  const mvpReadinessSnapshot =
    datasetReadinessSummary && exportPackageReadiness
      ? buildMvpReadinessSnapshot(
          datasetReadinessSummary,
          reportQualityBadge,
          exportPackageReadiness,
        )
      : null;
  const shapefileUploadMessages = buildShapefileUploadMessages(selectedFiles);
  const analyzeGuidanceText = getAnalyzeGuidanceText(
    selectedFiles,
    isUploading,
  );
  const blockedInputFiles = getBlockedInputFiles(allUploadResults);

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

        <div className="demo-guidance-grid">
          <div className="workflow-panel">
            <h3>GeoPrep AI Workflow</h3>

            <ol className="workflow-steps">
              {[
                "Upload files",
                "Inspect metadata",
                "Review CRS and bounds",
                "Detect raster-vector relationship",
                "Recommend GeoAI task",
                "Generate preparation plan",
                "Review export/package readiness",
              ].map((step, index) => (
                <li key={step}>
                  <span className="workflow-step-number">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <details className="test-scenarios-panel">
            <summary>MVP Test Scenarios</summary>

            <ul className="test-scenario-list">
              <li>
                <span className="scenario-tag">Raster</span>
                <span>
                  Upload a raster only file to test imagery-only readiness.
                  <strong> Expected: Raster-only workflow / needs review.</strong>
                </span>
              </li>
              <li>
                <span className="scenario-tag">CRS</span>
                <span>
                  Upload raster + vector files to test CRS and raster-vector
                  relationship checks.
                  <strong> Expected: CRS, bounds, and raster-vector checks.</strong>
                </span>
              </li>
              <li>
                <span className="scenario-tag">Blocked</span>
                <span>
                  Upload an incomplete shapefile to test blocked input handling.
                  <strong> Expected: Blocked by upload input.</strong>
                </span>
              </li>
              <li>
                <span className="scenario-tag">ZIP</span>
                <span>
                  Upload a complete shapefile set or ZIP package to test
                  shapefile package support.
                  <strong> Expected: Shapefile package support.</strong>
                </span>
              </li>
              <li>
                <span className="scenario-tag">Export</span>
                <span>
                  Export JSON/Markdown reports to verify handoff outputs.
                  <strong> Expected: JSON/Markdown handoff outputs.</strong>
                </span>
              </li>
            </ul>
          </details>
        </div>

        <div className="upload-controls-panel">
          <div className="upload-panel">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
            />

            <div className="upload-action-group">
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
          </div>

          <p className="analyze-guidance-text">{analyzeGuidanceText}</p>
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

            {shapefileUploadMessages.length > 0 && (
              <div className="shapefile-helper-panel">
                {shapefileUploadMessages.map((message) => (
                  <p
                    className={`shapefile-helper-${message.tone}`}
                    key={`${message.tone}-${message.text}`}
                  >
                    {message.text}
                  </p>
                ))}
              </div>
            )}
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
                formatStatusLabel(
                  batchResult.dataset_session.readiness_summary?.status,
                )
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
              {formatStatusLabel(datasetReadinessSummary.status)}
            </span>
          </div>

          <div className="report-main" ref={datasetSummaryRef}>
            <p className="report-summary">{datasetReadinessSummary.summary}</p>

            <div className="readiness-summary-grid">
              <div className="readiness-summary-card readiness-score-card">
                <span className="readiness-summary-label">Readiness</span>
                <span className="readiness-summary-score">
                  {datasetReadinessSummary.readiness_score}
                  <span>/100</span>
                </span>
              </div>

              <div className="readiness-summary-card">
                <span className="readiness-summary-label">Status</span>
                <span className="readiness-summary-value">
                  {formatStatusLabel(datasetReadinessSummary.status)}
                </span>
              </div>

              <div className="readiness-summary-card">
                <span className="readiness-summary-label">Raster</span>
                <span className="readiness-summary-value">
                  {datasetReadinessSummary.raster_count}
                </span>
              </div>

              <div className="readiness-summary-card">
                <span className="readiness-summary-label">Vector</span>
                <span className="readiness-summary-value">
                  {datasetReadinessSummary.vector_count}
                </span>
              </div>

              <div className="readiness-summary-card">
                <span className="readiness-summary-label">Supporting</span>
                <span className="readiness-summary-value">
                  {datasetReadinessSummary.supporting_file_count}
                </span>
              </div>

              <div className="readiness-summary-card">
                <span className="readiness-summary-label">Unsupported</span>
                <span className="readiness-summary-value">
                  {datasetReadinessSummary.unsupported_file_count}
                </span>
              </div>
            </div>
          </div>

          {mvpReadinessSnapshot && (
            <MvpReadinessSnapshotPanel snapshot={mvpReadinessSnapshot} />
          )}

          <div className="report-actions-panel">
            <h4>Report Actions</h4>

            <div className="report-actions-buttons">
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

              <button
                className="secondary-button export-report-button"
                onClick={handleCopyReportSummary}
                type="button"
              >
                {isSummaryCopied ? "Copied!" : "Copy Report Summary"}
              </button>

              {showCrsCorrectionShortcut && crsCorrectionInstructionSummary && (
                <button
                  className="secondary-button report-shortcut-button"
                  onClick={handleViewCrsCorrectionSteps}
                  type="button"
                >
                  View CRS correction steps
                </button>
              )}

              {firstActionableStepTitle && (
                <button
                  className="secondary-button report-shortcut-button"
                  onClick={handleViewFirstAction}
                  type="button"
                >
                  View first action
                </button>
              )}
            </div>

            <div className="report-section-controls">
              <button
                className="secondary-button"
                onClick={handleExpandAllReportSections}
                type="button"
              >
                Expand All
              </button>

              <button
                className="secondary-button"
                onClick={handleCollapseAllReportSections}
                type="button"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="report-navigation-panel">
            <h4>Report Navigation</h4>

            <div className="report-navigation-buttons">
              {reportNavigationItems.map((item) => (
                <button
                  className="report-navigation-button"
                  key={item.label}
                  onClick={() => handleReportNavigationClick(item)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="report-search-panel" ref={reportSearchRef}>
            <div className="card-header-row">
              <h4>Search report</h4>

              {hasReportSearchTerm && (
                <span className="small-muted">
                  {reportSearchMatches.length} matching section(s)
                </span>
              )}
            </div>

            <div className="report-search-controls">
              <input
                className="report-search-input"
                onChange={(event) => setReportSearchTerm(event.target.value)}
                placeholder="Search report..."
                type="search"
                value={reportSearchTerm}
              />

              {hasReportSearchTerm && (
                <button
                  className="secondary-button report-search-clear-button"
                  onClick={() => setReportSearchTerm("")}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>

            {hasReportSearchTerm && (
              <div className="report-search-results">
                {reportSearchMatches.length === 0 ? (
                  <p className="empty-filter-message">
                    No matching report sections found.
                  </p>
                ) : (
                  reportSearchMatches.map((match) => (
                    <button
                      className="report-search-result-button"
                      key={match.name}
                      onClick={() => handleReportSearchResultClick(match)}
                      type="button"
                    >
                      {match.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="report-preview" ref={reportPreviewRef}>
            <div className="report-preview-header">
              <h4>Report Preview</h4>

              {reportQualityBadge && (
                <div
                  className={`report-quality-badge quality-${reportQualityBadge.status}`}
                >
                  <strong>{reportQualityBadge.label}</strong>
                  <span>{reportQualityBadge.reason}</span>
                </div>
              )}
            </div>

            <div className="info-grid compact-grid report-preview-grid">
              <InfoItem
                label="Status"
                value={formatStatusLabel(datasetReadinessSummary.status)}
              />
              <InfoItem
                label="Readiness"
                value={`${datasetReadinessSummary.readiness_score}/100`}
              />
              <InfoItem
                label="Composition"
                value={formatReportPreviewComposition(datasetReadinessSummary)}
              />
              <InfoItem
                label="Recommended task"
                value={formatReportPreviewTask(taskRecommendationSummary)}
              />
              <InfoItem
                label="First actionable step"
                value={formatReportPreviewStep(preparationPlanSummary?.steps)}
              />
              <InfoItem
                label="Main issues"
                value={String(datasetReadinessSummary.issues.length)}
              />
              <InfoItem
                label="Next actions"
                value={String(datasetReadinessSummary.recommended_actions.length)}
              />
            </div>
          </div>

          {exportPackageReadiness && (
            <ExportPackageReadinessPanel
              onAction={handleViewExportPackageAction}
              panelRef={exportPackageReadinessRef}
              readiness={exportPackageReadiness}
            />
          )}

          {datasetReadinessSummary.status === "blocked_input" && (
            <BlockedInputPanel
              affectedFiles={blockedInputFiles}
              issues={datasetReadinessSummary.issues}
              onViewAffectedFiles={handleViewAffectedFiles}
              recommendedActions={datasetReadinessSummary.recommended_actions}
            />
          )}

          <ReportStatusTimeline steps={reportTimelineSteps} />

          {allUploadResults.length > 0 && (
            <div className="warning-summary-panel" ref={warningSummaryRef}>
              <div className="card-header-row">
                <div>
                  <h4>Warning Summary</h4>
                  <p className="small-muted">
                    File-level warnings across all uploaded files.
                  </p>
                </div>

                <span className="status-pill">
                  {warningSummary.totalWarnings} warning(s)
                </span>
              </div>

              {warningSummary.totalWarnings === 0 ? (
                <p className="success-text">No file-level warnings detected.</p>
              ) : (
                <>
                  <div className="info-grid compact-grid warning-summary-grid">
                    <InfoItem
                      label="Total warnings"
                      value={String(warningSummary.totalWarnings)}
                    />
                    <InfoItem
                      label="Files with warnings"
                      value={String(warningSummary.filesWithWarnings)}
                    />
                  </div>

                  <div className="warning-impact-panel">
                    <h5>Warning Impact</h5>

                    <div className="info-grid compact-grid warning-impact-grid">
                      <InfoItem
                        label="Blocking warnings"
                        value={String(warningSummary.blockingWarnings)}
                      />
                      <InfoItem
                        label="Review warnings"
                        value={String(warningSummary.reviewWarnings)}
                      />
                      <InfoItem
                        label="Informational warnings"
                        value={String(warningSummary.informationalWarnings)}
                      />
                    </div>

                    <p>{warningSummary.impactMessage}</p>
                  </div>

                  {warningSummary.warningActions.length > 0 && (
                    <div className="warning-actions-panel">
                      <h5>Warning Actions</h5>

                      <ul className="clean-list warning-actions-list">
                        {warningSummary.warningActions.map((action) => (
                          <li
                            key={`${action.code}-${action.recommendedAction}`}
                          >
                            <strong>{action.code}</strong>
                            <span>
                              {action.recommendedAction}
                              {action.affectedFileCount > 0
                                ? ` (${action.affectedFileCount} affected file(s))`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    className="secondary-button warning-summary-action"
                    onClick={handleViewWarningFiles}
                    type="button"
                  >
                    View warning files
                  </button>

                  <div className="warning-summary-columns">
                    <div>
                      <h5>Severity Counts</h5>
                      <ul className="clean-list warning-summary-list">
                        {warningSummary.severityCounts.map((item) => (
                          <li key={`severity-${item.label}`}>
                            {item.label}: {item.count}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h5>Warning Codes</h5>
                      <ul className="clean-list warning-summary-list">
                        {warningSummary.codeCounts.map((item) => (
                          <li key={`code-${item.label}`}>
                            {item.label}: {item.count}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h5>Affected Files</h5>
                      <ul className="clean-list warning-summary-list">
                        {warningSummary.affectedFiles.map((item) => (
                          <li key={`file-${item.filename}`}>
                            {item.filename}: {item.count} warning(s)
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {correctedValidationSummary && (
            <CollapsibleSection
              className={`corrected-validation-box validation-${correctedValidationSummary.status}`}
              isCollapsed={isSectionCollapsed(
                REPORT_SECTION_KEYS.CORRECTED_VALIDATION,
              )}
              onToggle={toggleSection}
              sectionKey={REPORT_SECTION_KEYS.CORRECTED_VALIDATION}
              sectionRef={setReportSectionRef(
                REPORT_SECTION_KEYS.CORRECTED_VALIDATION,
              )}
              title="Corrected Re-upload Validation"
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
            </CollapsibleSection>
          )}

          {crsSummary && (
            <CollapsibleSection
              className="crs-review-box"
              isCollapsed={isSectionCollapsed(REPORT_SECTION_KEYS.CRS_REVIEW)}
              onToggle={toggleSection}
              sectionKey={REPORT_SECTION_KEYS.CRS_REVIEW}
              sectionRef={setReportSectionRef(REPORT_SECTION_KEYS.CRS_REVIEW)}
              title="CRS Review"
            >
              <div className="card-header-row">
                <div>
                  <h4>CRS Review</h4>
                  <p className="small-muted">
                    Spatial CRS comparison across raster and vector files.
                  </p>
                </div>

                <span className={`status-pill status-${crsSummary.status}`}>
                  {formatStatusLabel(crsSummary.status)}
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
              {crsSummary.crs_groups.length === 0 && (
                <p className="empty-filter-message">
                  {getCrsGroupsEmptyText(crsSummary.status)}
                </p>
              )}
            </CollapsibleSection>
          )}

          {crsResolutionGuidanceSummary && (
            <CollapsibleSection
              className="crs-guidance-box"
              isCollapsed={isSectionCollapsed(REPORT_SECTION_KEYS.CRS_GUIDANCE)}
              onToggle={toggleSection}
              sectionKey={REPORT_SECTION_KEYS.CRS_GUIDANCE}
              sectionRef={setReportSectionRef(REPORT_SECTION_KEYS.CRS_GUIDANCE)}
              title="CRS Resolution Guidance"
            >
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
              {crsResolutionGuidanceSummary.file_guidance.length === 0 && (
                <p className="empty-filter-message">
                  {getCrsGuidanceEmptyText(
                    crsResolutionGuidanceSummary.status,
                  )}
                </p>
              )}
            </CollapsibleSection>
          )}

          {crsCorrectionInstructionSummary && (
            <CollapsibleSection
              className="crs-correction-box"
              isCollapsed={isSectionCollapsed(
                REPORT_SECTION_KEYS.CRS_CORRECTION,
              )}
              onToggle={toggleSection}
              sectionKey={REPORT_SECTION_KEYS.CRS_CORRECTION}
              sectionRef={setCrsCorrectionSectionRef}
              title="CRS Correction Instructions"
            >
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
              {crsCorrectionInstructionSummary.files_to_reproject.length ===
                0 && (
                <p className="empty-filter-message">
                  {getFilesToReprojectEmptyText(
                    crsCorrectionInstructionSummary.status,
                  )}
                </p>
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
              {crsCorrectionInstructionSummary.files_to_confirm.length === 0 && (
                <p className="empty-filter-message">
                  {getFilesToConfirmEmptyText(
                    crsCorrectionInstructionSummary.status,
                  )}
                </p>
              )}

              <div className="tool-instruction-grid">
                <ToolInstructionCard
                  emptyText={getToolInstructionEmptyText(
                    "ArcGIS Pro",
                    crsCorrectionInstructionSummary.status,
                  )}
                  title="ArcGIS Pro"
                  steps={crsCorrectionInstructionSummary.arcgis_pro_steps}
                />
                <ToolInstructionCard
                  emptyText={getToolInstructionEmptyText(
                    "QGIS",
                    crsCorrectionInstructionSummary.status,
                  )}
                  title="QGIS"
                  steps={crsCorrectionInstructionSummary.qgis_steps}
                />
                <ToolInstructionCard
                  emptyText={getToolInstructionEmptyText(
                    "Python / GeoPandas",
                    crsCorrectionInstructionSummary.status,
                  )}
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
            </CollapsibleSection>
          )}

          {boundsSummary && (
            <CollapsibleSection
              className="bounds-review-box"
              isCollapsed={isSectionCollapsed(REPORT_SECTION_KEYS.BOUNDS_REVIEW)}
              onToggle={toggleSection}
              sectionKey={REPORT_SECTION_KEYS.BOUNDS_REVIEW}
              sectionRef={setReportSectionRef(REPORT_SECTION_KEYS.BOUNDS_REVIEW)}
              title="Bounds Review"
            >
              <div className="card-header-row">
                <div>
                  <h4>Bounds Review</h4>
                  <p className="small-muted">
                    Spatial bounds and overlap readiness across raster and
                    vector files.
                  </p>
                </div>

                <span className={`status-pill status-${boundsSummary.status}`}>
                  {formatStatusLabel(boundsSummary.status)}
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
            </CollapsibleSection>
          )}

          {rasterVectorRelationshipSummary && (
            <CollapsibleSection
              className="relationship-review-box"
              isCollapsed={isSectionCollapsed(
                REPORT_SECTION_KEYS.RASTER_VECTOR_RELATIONSHIP,
              )}
              onToggle={toggleSection}
              sectionKey={REPORT_SECTION_KEYS.RASTER_VECTOR_RELATIONSHIP}
              sectionRef={setReportSectionRef(
                REPORT_SECTION_KEYS.RASTER_VECTOR_RELATIONSHIP,
              )}
              title="Raster-Vector Relationship"
            >
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
                  {formatStatusLabel(rasterVectorRelationshipSummary.status)}
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
            </CollapsibleSection>
          )}

          {taskRecommendationSummary && (
            <CollapsibleSection
              className="task-recommendation-box"
              isCollapsed={isSectionCollapsed(
                REPORT_SECTION_KEYS.TASK_RECOMMENDATION,
              )}
              onToggle={toggleSection}
              sectionKey={REPORT_SECTION_KEYS.TASK_RECOMMENDATION}
              sectionRef={setReportSectionRef(
                REPORT_SECTION_KEYS.TASK_RECOMMENDATION,
              )}
              title="Dataset Task Recommendation"
            >
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
                  {formatStatusLabel(taskRecommendationSummary.status)}
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
            </CollapsibleSection>
          )}

          {preparationPlanSummary && (
            <CollapsibleSection
              className="preparation-plan-box"
              isCollapsed={isSectionCollapsed(
                REPORT_SECTION_KEYS.PREPARATION_PLAN,
              )}
              onToggle={toggleSection}
              sectionKey={REPORT_SECTION_KEYS.PREPARATION_PLAN}
              sectionRef={setPreparationPlanSectionRef}
              title="Dataset Preparation Plan"
            >
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
                        ref={(element) => {
                          preparationStepRefs.current[
                            normalizeStepTitle(step.title)
                          ] = element;
                        }}
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
            </CollapsibleSection>
          )}

          <CollapsibleSection
            className="report-columns-section"
            isCollapsed={isSectionCollapsed(REPORT_SECTION_KEYS.DATASET_ISSUES)}
            onToggle={toggleSection}
            sectionKey={REPORT_SECTION_KEYS.DATASET_ISSUES}
            sectionRef={setReportSectionRef(REPORT_SECTION_KEYS.DATASET_ISSUES)}
            title="Dataset Issues"
          >
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
          </CollapsibleSection>
        </div>
      )}

      {allUploadResults.length > 0 && (
        <CollapsibleSection
          className="file-results-section"
          isCollapsed={isSectionCollapsed(REPORT_SECTION_KEYS.FILE_RESULTS)}
          onToggle={toggleSection}
          sectionKey={REPORT_SECTION_KEYS.FILE_RESULTS}
          sectionRef={setReportSectionRef(REPORT_SECTION_KEYS.FILE_RESULTS)}
          title="Uploaded Files Overview / File-Level Analysis"
        >
          <div className="card full-width-card" ref={fileOverviewRef}>
            <div className="card-header-row">
              <h3>Uploaded Files Overview</h3>
              <span className="small-muted">
                {filteredUploadResults.length} of {allUploadResults.length}{" "}
                file(s)
              </span>
            </div>

            <FileFilterTabs
              counts={fileFilterCounts}
              selectedFilter={selectedFileFilter}
              onSelectFilter={handleSelectFileFilter}
            />

            {selectedFileFilter === FILE_FILTER_KEYS.WARNINGS &&
              filteredUploadResults.length > 0 && (
                <p className="warning-filter-helper">
                  Showing only files with warnings.
                </p>
              )}

            {filteredUploadResults.length === 0 ? (
              <p className="empty-filter-message">
                {selectedFileFilter === FILE_FILTER_KEYS.WARNINGS
                  ? "No files with warnings."
                  : "No files match this filter."}
              </p>
            ) : (
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
                    {filteredUploadResults.map((result) => {
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
                          <td>{formatStatusLabel(result.file_category)}</td>
                          <td>{formatStatusLabel(gisType)}</td>
                          <td>
                            {readinessScore !== null
                              ? `${readinessScore}/100`
                              : "N/A"}
                          </td>
                          <td>
                            <span
                              className={`status-pill status-${readinessStatus}`}
                            >
                              {formatStatusLabel(readinessStatus)}
                            </span>
                          </td>
                          <td>{warningCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="file-report-section">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">File-Level Analysis</p>
                <h3>Detailed File Reports</h3>
              </div>
            </div>

            {filteredUploadResults.length === 0 ? (
              <p className="empty-filter-message">No files match this filter.</p>
            ) : (
              <div className="file-report-grid">
                {filteredUploadResults.map((result) => (
                  <FileReportCard key={result.saved_filename} result={result} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}
    </section>
  );
}

type CollapsibleSectionProps = {
  children: ReactNode;
  className?: string;
  isCollapsed: boolean;
  onToggle: (sectionKey: ReportSectionKey) => void;
  sectionKey: ReportSectionKey;
  sectionRef?: Ref<HTMLDivElement>;
  title: string;
};

function CollapsibleSection({
  children,
  className,
  isCollapsed,
  onToggle,
  sectionKey,
  sectionRef,
  title,
}: CollapsibleSectionProps) {
  return (
    <div className={className} ref={sectionRef}>
      <div className="collapsible-section-header">
        <h4>{title}</h4>
        <button
          className="collapsible-section-toggle"
          onClick={() => onToggle(sectionKey)}
          type="button"
        >
          {isCollapsed ? "Show" : "Hide"}
        </button>
      </div>

      <div className="collapsible-section-body" hidden={isCollapsed}>
        {children}
      </div>
    </div>
  );
}

type ReportTimelineStatus = "passed" | "ready" | "review" | "blocked" | "na";

type ExportPackageReadiness = {
  status: "blocked" | "ready" | "review";
  statusLabel: string;
  reason: string;
  nextAction: string;
  actionLabel: string;
  checklist: string[];
  preview: ExportPackagePreview;
  packageButtonLabel: string;
  packageHelperText: string;
};

type ExportPackagePreview = {
  packageStatus: string;
  includedTitle: string;
  includedItems: string[];
  optionalTitle?: string;
  optionalItems?: string[];
};

type MvpReadinessSnapshot = {
  datasetUsability: string;
  mainLabel: string;
  mainMessage: string;
  bestNextAction: string;
  taskDirection: string;
  exportPackageState: string;
};

function MvpReadinessSnapshotPanel({
  snapshot,
}: {
  snapshot: MvpReadinessSnapshot;
}) {
  return (
    <div className="mvp-readiness-snapshot">
      <div>
        <h4>MVP Readiness Snapshot</h4>
        <p className="small-muted">
          Quick read on what this dataset can do next.
        </p>
      </div>

      <div className="info-grid compact-grid mvp-snapshot-grid">
        <InfoItem label="Dataset usability" value={snapshot.datasetUsability} />
        <InfoItem label={snapshot.mainLabel} value={snapshot.mainMessage} />
        <InfoItem label="Best next action" value={snapshot.bestNextAction} />
        <InfoItem label="GeoAI task direction" value={snapshot.taskDirection} />
        <InfoItem
          label="Export/package state"
          value={snapshot.exportPackageState}
        />
      </div>
    </div>
  );
}

function ExportPackageReadinessPanel({
  onAction,
  panelRef,
  readiness,
}: {
  onAction: () => void;
  panelRef: Ref<HTMLDivElement>;
  readiness: ExportPackageReadiness;
}) {
  return (
    <div className="export-package-readiness-panel" ref={panelRef}>
      <div className="card-header-row">
        <div>
          <h4>Export Package Readiness</h4>
          <p className="small-muted">
            Whether this dataset can move into model-ready package export.
          </p>
        </div>

        <span
          className={`export-package-status export-package-${readiness.status}`}
        >
          {readiness.statusLabel}
        </span>
      </div>

      <div className="info-grid compact-grid export-package-grid">
        <InfoItem label="Reason" value={readiness.reason} />
        <InfoItem label="Next action" value={readiness.nextAction} />
      </div>

      <div className="export-package-checklist">
        <h5>Export Package Checklist</h5>

        <ul className="export-package-checklist-list">
          {readiness.checklist.map((item) => (
            <li key={item}>
              <span className="export-package-check-marker" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="export-package-preview">
        <h5>Export Package Preview</h5>

        <div className="info-grid compact-grid export-package-preview-grid">
          <InfoItem
            label="Package status"
            value={readiness.preview.packageStatus}
          />
        </div>

        <div className="export-package-preview-columns">
          <div>
            <h6>{readiness.preview.includedTitle}</h6>
            <ul className="export-package-preview-list">
              {readiness.preview.includedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {readiness.preview.optionalItems &&
            readiness.preview.optionalItems.length > 0 && (
              <div>
                <h6>{readiness.preview.optionalTitle ?? "Optional"}</h6>
                <ul className="export-package-preview-list">
                  {readiness.preview.optionalItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      </div>

      <button
        className="secondary-button export-package-action-button"
        onClick={onAction}
        type="button"
      >
        {readiness.actionLabel}
      </button>

      <div className="export-package-download-placeholder">
        <button
          className="secondary-button export-package-download-button"
          disabled
          type="button"
        >
          {readiness.packageButtonLabel}
        </button>
        <p className="small-muted">{readiness.packageHelperText}</p>
      </div>
    </div>
  );
}

function BlockedInputPanel({
  affectedFiles,
  issues,
  onViewAffectedFiles,
  recommendedActions,
}: {
  affectedFiles: UploadResponse[];
  issues: string[];
  onViewAffectedFiles: () => void;
  recommendedActions: string[];
}) {
  const visibleIssues = issues.slice(0, 3);
  const visibleActions = recommendedActions.slice(0, 3);

  return (
    <div className="blocked-input-panel">
      <div>
        <h4>Upload Input Blocked</h4>
        <p>One or more uploaded files cannot continue to dataset checks.</p>
      </div>

      {affectedFiles.length > 0 && (
        <div className="blocked-input-section">
          <h5>Affected Files</h5>
          <ul className="clean-list blocked-input-file-list">
            {affectedFiles.map((result) => (
              <li key={result.saved_filename}>{result.original_filename}</li>
            ))}
          </ul>
        </div>
      )}

      {visibleIssues.length > 0 && (
        <div className="blocked-input-section">
          <h5>Main Issues</h5>
          <ul className="clean-list">
            {visibleIssues.map((issue, index) => (
              <li key={`blocked-input-issue-${index}`}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {visibleActions.length > 0 && (
        <div className="blocked-input-section">
          <h5>Recommended Actions</h5>
          <ul className="clean-list">
            {visibleActions.map((action, index) => (
              <li key={`blocked-input-action-${index}`}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        className="secondary-button blocked-input-action-button"
        onClick={onViewAffectedFiles}
        type="button"
      >
        View affected files
      </button>
    </div>
  );
}

function getBlockedInputFiles(results: UploadResponse[]): UploadResponse[] {
  return results.filter((result) => {
    const hasErrorWarning = (result.warnings ?? []).some(
      (warning) => warning.severity === "error",
    );

    return (
      result.readiness_report?.can_continue_to_dataset === false ||
      result.gis_metadata?.inspection_status === "failed" ||
      hasErrorWarning
    );
  });
}

type ShapefileHelperMessage = {
  text: string;
  tone: "info" | "warning" | "success";
};

type SelectedShapefileGroup = {
  baseName: string;
  filesByExtension: Partial<Record<string, File>>;
  hasMainFile: boolean;
};

const SHAPEFILE_COMPONENT_EXTENSIONS = [".shp", ".shx", ".dbf", ".prj"];
const REQUIRED_SHAPEFILE_EXTENSIONS = [".shx", ".dbf"];
const ZIP_EXTENSION = ".zip";

function getAnalyzeGuidanceText(
  selectedFiles: File[],
  isUploading: boolean,
): string {
  if (isUploading) {
    return "Analyzing dataset files...";
  }

  if (selectedFiles.length === 0) {
    return "Select one or more dataset files to start analysis.";
  }

  if (hasIncompleteSelectedShapefile(selectedFiles)) {
    return "Selected shapefile is incomplete. You can still analyze to see the blocked-input report, or upload the full shapefile set.";
  }

  return "Ready to analyze selected files.";
}

function hasIncompleteSelectedShapefile(selectedFiles: File[]): boolean {
  return getSelectedShapefileGroups(selectedFiles).some((group) => {
    if (!group.hasMainFile) {
      return false;
    }

    return REQUIRED_SHAPEFILE_EXTENSIONS.some(
      (extension) => !group.filesByExtension[extension],
    );
  });
}

function buildShapefileUploadMessages(
  selectedFiles: File[],
): ShapefileHelperMessage[] {
  const shapefileGroups = getSelectedShapefileGroups(selectedFiles);
  const zipMessages = selectedFiles
    .filter((file) => getFileExtension(file.name) === ZIP_EXTENSION)
    .map((file) => ({
      tone: "info" as const,
      text: `${file.name}: ZIP shapefile package detected. Make sure it contains .shp, .shx, .dbf, and .prj if available.`,
    }));

  if (shapefileGroups.length === 0) {
    return zipMessages;
  }

  const shapefileMessages: ShapefileHelperMessage[] = shapefileGroups.map((group) => {
    if (!group.hasMainFile) {
      return {
        tone: "warning",
        text: "Shapefile sidecar files were selected without a matching .shp file.",
      };
    }

    const mainFile = group.filesByExtension[".shp"];
    const missingRequiredExtensions = REQUIRED_SHAPEFILE_EXTENSIONS.filter(
      (extension) => !group.filesByExtension[extension],
    );

    if (missingRequiredExtensions.length > 0) {
      return {
        tone: "warning",
        text: `${
          mainFile?.name ?? `${group.baseName}.shp`
        } is missing required sidecar files: ${missingRequiredExtensions.join(
          ", ",
        )}. Upload the complete shapefile set together.`,
      };
    }

    if (!group.filesByExtension[".prj"]) {
      return {
        tone: "info",
        text: "Required shapefile files are selected. Add .prj if available so GeoPrep AI can read CRS metadata.",
      };
    }

    return {
      tone: "success",
      text: `Complete shapefile group detected for ${
        mainFile?.name ?? `${group.baseName}.shp`
      }.`,
    };
  });

  return [...zipMessages, ...shapefileMessages];
}

function getSelectedShapefileGroups(
  selectedFiles: File[],
): SelectedShapefileGroup[] {
  const groups = new Map<string, SelectedShapefileGroup>();

  selectedFiles.forEach((file) => {
    const extension = getFileExtension(file.name);

    if (!SHAPEFILE_COMPONENT_EXTENSIONS.includes(extension)) {
      return;
    }

    const baseName = getFileBaseName(file.name).toLowerCase();
    const group =
      groups.get(baseName) ??
      {
        baseName,
        filesByExtension: {},
        hasMainFile: false,
      };

    group.filesByExtension[extension] = file;
    group.hasMainFile = group.hasMainFile || extension === ".shp";
    groups.set(baseName, group);
  });

  return Array.from(groups.values());
}

function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return "";
  }

  return filename.slice(lastDotIndex).toLowerCase();
}

function getFileBaseName(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return filename;
  }

  return filename.slice(0, lastDotIndex);
}

type ReportTimelineStep = {
  label: string;
  status: ReportTimelineStatus;
  statusLabel: string;
  explanation: string;
};

function ReportStatusTimeline({ steps }: { steps: ReportTimelineStep[] }) {
  return (
    <div className="report-timeline-panel">
      <h4>Report Status Timeline</h4>

      <div className="report-timeline">
        {steps.map((step) => (
          <div className="report-timeline-step" key={step.label}>
            <span className="timeline-step-label">{step.label}</span>
            <span className={`timeline-status timeline-${step.status}`}>
              {step.statusLabel}
            </span>
            <span className="timeline-step-explanation">
              {step.explanation}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildReportTimelineSteps(
  datasetSession: DatasetSession,
  datasetReadinessSummary: DatasetReadinessSummary,
): ReportTimelineStep[] {
  const crsSummary = datasetReadinessSummary.crs_summary;
  const boundsSummary = datasetReadinessSummary.bounds_summary;
  const relationshipSummary =
    datasetReadinessSummary.raster_vector_relationship_summary;
  const taskSummary = datasetReadinessSummary.task_recommendation_summary;
  const planSummary = datasetReadinessSummary.preparation_plan_summary;

  return [
    buildUploadTimelineStep(datasetSession, datasetReadinessSummary.status),
    buildCrsTimelineStep(crsSummary?.status),
    buildBoundsTimelineStep(boundsSummary?.status),
    buildRasterVectorTimelineStep(relationshipSummary?.status),
    buildTaskTimelineStep(taskSummary?.status),
    buildPlanTimelineStep(planSummary),
    buildExportTimelineStep(planSummary),
  ];
}

function buildExportPackageReadiness(
  datasetReadinessSummary: DatasetReadinessSummary,
  timelineSteps: ReportTimelineStep[],
): ExportPackageReadiness {
  const planSummary = datasetReadinessSummary.preparation_plan_summary;
  const planBlockers = planSummary?.blockers ?? [];
  const exportStep = timelineSteps.find((step) => step.label === "Export");
  const nextAction = getFirstRecommendedAction(datasetReadinessSummary);

  if (datasetReadinessSummary.status === "blocked_input") {
    return {
      status: "blocked",
      statusLabel: "Blocked",
      reason:
        "Upload input issues must be fixed before a model-ready package can be exported.",
      nextAction:
        nextAction ??
        "Fix upload input issues, then upload the corrected dataset again.",
      actionLabel: "View blocking action",
      checklist: buildExportPackageChecklist(datasetReadinessSummary),
      ...buildExportPackagePlaceholderDetails(datasetReadinessSummary, "blocked"),
    };
  }

  if (datasetReadinessSummary.status === "needs_crs_review") {
    return {
      status: "blocked",
      statusLabel: "Blocked",
      reason:
        "CRS issues must be resolved before export/package steps are trusted.",
      nextAction:
        nextAction ?? "Reproject or confirm CRS, then re-upload corrected files.",
      actionLabel: "View blocking action",
      checklist: buildExportPackageChecklist(datasetReadinessSummary),
      ...buildExportPackagePlaceholderDetails(datasetReadinessSummary, "blocked"),
    };
  }

  if (
    ["mixed_crs", "missing_crs", "unresolved_crs"].includes(
      datasetReadinessSummary.crs_summary?.status ?? "",
    )
  ) {
    return {
      status: "blocked",
      statusLabel: "Blocked",
      reason:
        "CRS issues must be resolved before export/package steps are trusted.",
      nextAction:
        nextAction ?? "Reproject or confirm CRS, then re-upload corrected files.",
      actionLabel: "View blocking action",
      checklist: buildExportPackageChecklist(datasetReadinessSummary),
      ...buildExportPackagePlaceholderDetails(datasetReadinessSummary, "blocked"),
    };
  }

  if (planSummary?.status === "plan_blocked" || planBlockers.length > 0) {
    return {
      status: "blocked",
      statusLabel: "Blocked",
      reason:
        "Preparation plan blockers must be resolved before export/package steps.",
      nextAction:
        nextAction ?? planBlockers[0] ?? "Resolve preparation blockers first.",
      actionLabel: "View blocking action",
      checklist: buildExportPackageChecklist(datasetReadinessSummary),
      ...buildExportPackagePlaceholderDetails(datasetReadinessSummary, "blocked"),
    };
  }

  if (
    ["raster_only", "vector_only"].includes(datasetReadinessSummary.status)
  ) {
    return buildSingleWorkflowExportReadiness(datasetReadinessSummary, nextAction);
  }

  if (exportStep && ["ready", "passed"].includes(exportStep.status)) {
    return {
      status: "ready",
      statusLabel: "Ready",
      reason: "Dataset checks indicate an export/package step is ready.",
      nextAction:
        nextAction ??
        "Continue with the ready export/package step in the preparation plan.",
      actionLabel: "View export step",
      checklist: buildExportPackageChecklist(datasetReadinessSummary),
      ...buildExportPackagePlaceholderDetails(datasetReadinessSummary, "ready"),
    };
  }

  return {
    status: "review",
    statusLabel: "Needs review",
    reason: "Export/package readiness still needs review before packaging.",
    nextAction:
      nextAction ??
      "Review the preparation plan and complete the first actionable step.",
    actionLabel: "View preparation plan",
    checklist: buildExportPackageChecklist(datasetReadinessSummary),
    ...buildExportPackagePlaceholderDetails(datasetReadinessSummary, "review"),
  };
}

function buildSingleWorkflowExportReadiness(
  datasetReadinessSummary: DatasetReadinessSummary,
  nextAction: string | null,
): ExportPackageReadiness {
  if (datasetReadinessSummary.status === "raster_only") {
    return {
      status: "review",
      statusLabel: "Ready with review",
      reason:
        "Dataset can be exported for imagery-only preparation, but add vector labels if supervised GeoAI training is required.",
      nextAction:
        nextAction ??
        "Continue with raster tiling, statistics, and imagery-only preparation.",
      actionLabel: "View preparation plan",
      checklist: buildExportPackageChecklist(datasetReadinessSummary),
      ...buildExportPackagePlaceholderDetails(datasetReadinessSummary, "review"),
    };
  }

  return {
    status: "review",
    statusLabel: "Ready with review",
    reason:
      "Dataset can be exported for vector-only preparation, but add raster imagery if labels should be matched to imagery.",
    nextAction:
      nextAction ??
      "Continue with vector cleanup, attributes, and task-specific preparation.",
    actionLabel: "View preparation plan",
    checklist: buildExportPackageChecklist(datasetReadinessSummary),
    ...buildExportPackagePlaceholderDetails(datasetReadinessSummary, "review"),
  };
}

function buildExportPackagePlaceholderDetails(
  datasetReadinessSummary: DatasetReadinessSummary,
  readinessStatus: ExportPackageReadiness["status"],
): Pick<
  ExportPackageReadiness,
  "preview" | "packageButtonLabel" | "packageHelperText"
> {
  if (readinessStatus === "blocked") {
    return {
      preview: buildExportPackagePreview(datasetReadinessSummary),
      packageButtonLabel: "Package blocked",
      packageHelperText:
        "Resolve blockers before generating a model-ready package.",
    };
  }

  if (readinessStatus === "ready") {
    return {
      preview: buildExportPackagePreview(datasetReadinessSummary),
      packageButtonLabel: "Download model-ready package",
      packageHelperText: "Package generation backend is not implemented yet.",
    };
  }

  return {
    preview: buildExportPackagePreview(datasetReadinessSummary),
    packageButtonLabel: "Prepare package soon",
    packageHelperText:
      "Package generation will be enabled after export package creation is implemented.",
  };
}

function buildExportPackagePreview(
  datasetReadinessSummary: DatasetReadinessSummary,
): ExportPackagePreview {
  if (datasetReadinessSummary.status === "blocked_input") {
    return {
      packageStatus: "Not ready",
      includedTitle: "Would include after fixes",
      includedItems: [
        "Corrected source files",
        "CRS metadata",
        "Readiness report",
        "Warnings and recommended actions",
      ],
    };
  }

  if (datasetReadinessSummary.status === "raster_only") {
    return {
      packageStatus: "Preview available",
      includedTitle: "Included",
      includedItems: [
        "Raster imagery files",
        "CRS metadata",
        "Raster metadata such as size/bands/nodata review",
        "Readiness report",
      ],
      optionalTitle: "Optional / recommended",
      optionalItems: ["Vector labels if supervised training is required"],
    };
  }

  if (datasetReadinessSummary.status === "vector_only") {
    return {
      packageStatus: "Preview available",
      includedTitle: "Included",
      includedItems: [
        "Vector files",
        "CRS metadata",
        "Attribute/geometry readiness notes",
        "Readiness report",
      ],
      optionalTitle: "Optional / recommended",
      optionalItems: ["Raster imagery if image-based GeoAI training is required"],
    };
  }

  return {
    packageStatus: isDatasetExportBlocked(datasetReadinessSummary)
      ? "Not ready"
      : "Ready preview",
    includedTitle: isDatasetExportBlocked(datasetReadinessSummary)
      ? "Would include after fixes"
      : "Included",
    includedItems: [
      "Raster files",
      "Vector label/annotation files",
      "CRS metadata",
      "Preparation report and warnings",
      "Task recommendation",
    ],
  };
}

function isDatasetExportBlocked(
  datasetReadinessSummary: DatasetReadinessSummary,
): boolean {
  return (
    datasetReadinessSummary.status === "blocked_input" ||
    datasetReadinessSummary.status === "needs_crs_review" ||
    ["mixed_crs", "missing_crs", "unresolved_crs"].includes(
      datasetReadinessSummary.crs_summary?.status ?? "",
    ) ||
    datasetReadinessSummary.preparation_plan_summary?.status ===
      "plan_blocked" ||
    (datasetReadinessSummary.preparation_plan_summary?.blockers.length ?? 0) > 0
  );
}

type ExportPackageSummary = {
  status_label: string;
  status_key: string;
  reason: string;
  next_action: string;
  checklist_items: string[];
  package_preview_status: string;
  package_preview_included_items: string[];
  package_preview_optional_items?: string[];
  package_button_label: string;
  package_button_disabled: boolean;
  package_helper_text: string;
};

function buildExportPackageSummary(
  readiness: ExportPackageReadiness,
): ExportPackageSummary {
  const summary: ExportPackageSummary = {
    status_label: readiness.statusLabel,
    status_key: readiness.status,
    reason: readiness.reason,
    next_action: readiness.nextAction,
    checklist_items: readiness.checklist,
    package_preview_status: readiness.preview.packageStatus,
    package_preview_included_items: readiness.preview.includedItems,
    package_button_label: readiness.packageButtonLabel,
    package_button_disabled: true,
    package_helper_text: readiness.packageHelperText,
  };

  if (
    readiness.preview.optionalItems &&
    readiness.preview.optionalItems.length > 0
  ) {
    summary.package_preview_optional_items = readiness.preview.optionalItems;
  }

  return summary;
}

function formatExportPackagePlainTextSummary(
  readiness: ExportPackageReadiness | null,
): string {
  if (!readiness) {
    return "Not available";
  }

  return `${formatPlainTextValue(readiness.statusLabel)} - ${formatPlainTextValue(
    readiness.reason,
  )}`;
}

function formatExportPackageReadinessMarkdown(
  readiness: ExportPackageReadiness | null,
): string {
  if (!readiness) {
    return [
      "## Export Package Readiness",
      "- Status: Not available",
      "- Reason: Export package readiness is not available.",
    ].join("\n");
  }

  const summary = buildExportPackageSummary(readiness);
  const optionalItems = summary.package_preview_optional_items ?? [];

  return [
    "## Export Package Readiness",
    `- Status: ${formatMarkdownValue(summary.status_label)}`,
    `- Reason: ${formatMarkdownValue(summary.reason)}`,
    `- Next action: ${formatMarkdownValue(summary.next_action)}`,
    "",
    "### Export Package Checklist",
    formatMarkdownList(summary.checklist_items, "No export checklist items available."),
    "",
    "### Export Package Preview",
    `- Package status: ${formatMarkdownValue(summary.package_preview_status)}`,
    "- Included:",
    formatNestedMarkdownList(
      summary.package_preview_included_items,
      "No package preview items available.",
    ),
    "- Optional / recommended:",
    formatNestedMarkdownList(optionalItems, "No optional package items listed."),
    "",
    "### Package Action",
    `- Button state: ${formatMarkdownValue(summary.package_button_label)} (${summary.package_button_disabled ? "disabled" : "enabled"})`,
    `- Note: ${formatMarkdownValue(summary.package_helper_text)}`,
  ].join("\n");
}

function buildExportPackageChecklist(
  datasetReadinessSummary: DatasetReadinessSummary,
): string[] {
  if (datasetReadinessSummary.status === "blocked_input") {
    return [
      "Fix upload input issues",
      "Re-run dataset checks",
      "Export corrected files",
      "Include metadata and readiness report",
    ];
  }

  if (
    datasetReadinessSummary.status === "needs_crs_review" ||
    ["mixed_crs", "missing_crs", "unresolved_crs"].includes(
      datasetReadinessSummary.crs_summary?.status ?? "",
    )
  ) {
    return [
      "Resolve CRS issues",
      "Re-upload corrected files",
      "Confirm bounds/relationship checks",
      "Include metadata and readiness report",
    ];
  }

  if (datasetReadinessSummary.status === "raster_only") {
    return [
      "Export raster imagery",
      "Include CRS metadata",
      "Include raster statistics / nodata review",
      "Add vector labels if supervised training is required",
    ];
  }

  if (datasetReadinessSummary.status === "vector_only") {
    return [
      "Export vector layers",
      "Include CRS metadata",
      "Add raster imagery if image-based GeoAI training is required",
      "Include readiness report",
    ];
  }

  return [
    "Export corrected raster/vector files",
    "Include CRS metadata",
    "Include preparation report and warnings",
    "Package for selected GeoAI workflow",
  ];
}

function getFirstRecommendedAction(
  datasetReadinessSummary: DatasetReadinessSummary,
): string | null {
  return (
    datasetReadinessSummary.recommended_actions[0] ??
    datasetReadinessSummary.preparation_plan_summary?.recommended_actions[0] ??
    null
  );
}

function buildUploadTimelineStep(
  datasetSession: DatasetSession,
  datasetStatus: string,
): ReportTimelineStep {
  if (datasetStatus === "blocked_input") {
    return {
      label: "Upload",
      status: "blocked",
      statusLabel: "Blocked",
      explanation: "One or more uploaded files cannot continue.",
    };
  }

  if (datasetSession.file_count > 0) {
    return {
      label: "Upload",
      status: "passed",
      statusLabel: "Passed",
      explanation: `${datasetSession.file_count} file(s) uploaded.`,
    };
  }

  return {
    label: "Upload",
    status: "review",
    statusLabel: "Needs Review",
    explanation: "No uploaded dataset files are available yet.",
  };
}

function buildCrsTimelineStep(status: string | undefined): ReportTimelineStep {
  if (status === "consistent_crs") {
    return {
      label: "CRS",
      status: "passed",
      statusLabel: "Passed",
      explanation: "CRS is consistent across comparable spatial files.",
    };
  }

  if (
    ["mixed_crs", "missing_crs", "unresolved_crs", "blocked_by_input"].includes(
      status ?? "",
    )
  ) {
    return {
      label: "CRS",
      status: "blocked",
      statusLabel: "Blocked",
      explanation: "CRS issues must be resolved before preparation continues.",
    };
  }

  return {
    label: "CRS",
    status: "review",
    statusLabel: "Needs Review",
    explanation: "CRS status still needs review.",
  };
}

function buildBoundsTimelineStep(
  status: string | undefined,
): ReportTimelineStep {
  if (status === "overlapping_bounds") {
    return {
      label: "Bounds",
      status: "passed",
      statusLabel: "Passed",
      explanation: "Spatial bounds overlap enough for dataset preparation.",
    };
  }

  if (status === "single_spatial_file") {
    return {
      label: "Bounds",
      status: "na",
      statusLabel: "Not Applicable",
      explanation: "Only one spatial file is available for bounds comparison.",
    };
  }

  if (
    ["blocked_by_input", "blocked_by_crs_review", "no_spatial_overlap"].includes(
      status ?? "",
    )
  ) {
    return {
      label: "Bounds",
      status: "blocked",
      statusLabel: "Blocked",
      explanation: "Bounds checks cannot move forward yet.",
    };
  }

  return {
    label: "Bounds",
    status: "review",
    statusLabel: "Needs Review",
    explanation: "Bounds readiness still needs review.",
  };
}

function buildRasterVectorTimelineStep(
  status: string | undefined,
): ReportTimelineStep {
  if (status === "candidate_geoai_dataset") {
    return {
      label: "Raster-Vector",
      status: "passed",
      statusLabel: "Passed",
      explanation: "Raster and vector inputs appear suitable together.",
    };
  }

  if (
    ["raster_only", "vector_only", "single_spatial_file", "no_raster_vector_pair"].includes(
      status ?? "",
    )
  ) {
    return {
      label: "Raster-Vector",
      status: "na",
      statusLabel: "Not Applicable",
      explanation: "No raster-vector pair is available for relationship checks.",
    };
  }

  if (
    [
      "blocked_by_input",
      "blocked_by_crs_review",
      "blocked_by_bounds_review",
    ].includes(status ?? "")
  ) {
    return {
      label: "Raster-Vector",
      status: "blocked",
      statusLabel: "Blocked",
      explanation: "Relationship checks are waiting on earlier blockers.",
    };
  }

  return {
    label: "Raster-Vector",
    status: "review",
    statusLabel: "Needs Review",
    explanation: "Raster-vector relationship still needs review.",
  };
}

function buildTaskTimelineStep(status: string | undefined): ReportTimelineStep {
  if (status === "task_candidate") {
    return {
      label: "Task",
      status: "ready",
      statusLabel: "Ready",
      explanation: "A task candidate is available for preparation.",
    };
  }

  if (
    [
      "blocked_by_input",
      "blocked_by_crs_review",
      "blocked_by_bounds_review",
      "blocked_by_relationship_review",
    ].includes(status ?? "")
  ) {
    return {
      label: "Task",
      status: "blocked",
      statusLabel: "Blocked",
      explanation: "Task recommendation is blocked by earlier checks.",
    };
  }

  return {
    label: "Task",
    status: "review",
    statusLabel: "Needs Review",
    explanation: "Task recommendation still needs review.",
  };
}

function buildPlanTimelineStep(
  planSummary: DatasetReadinessSummary["preparation_plan_summary"],
): ReportTimelineStep {
  if (!planSummary) {
    return {
      label: "Plan",
      status: "review",
      statusLabel: "Needs Review",
      explanation: "No preparation plan is available yet.",
    };
  }

  if (planSummary.status === "plan_blocked" || planSummary.blockers.length > 0) {
    return {
      label: "Plan",
      status: "blocked",
      statusLabel: "Blocked",
      explanation: "Preparation plan has blockers to resolve.",
    };
  }

  if (planSummary.status === "plan_needs_review") {
    return {
      label: "Plan",
      status: "review",
      statusLabel: "Needs Review",
      explanation: "Preparation plan is available but needs review.",
    };
  }

  if (hasReadyPreparationStep(planSummary.steps)) {
    return {
      label: "Plan",
      status: "ready",
      statusLabel: "Ready",
      explanation: "At least one preparation step is ready to run.",
    };
  }

  return {
    label: "Plan",
    status: "ready",
    statusLabel: "Ready",
    explanation: "Preparation plan is available.",
  };
}

function buildExportTimelineStep(
  planSummary: DatasetReadinessSummary["preparation_plan_summary"],
): ReportTimelineStep {
  if (!planSummary) {
    return {
      label: "Export",
      status: "review",
      statusLabel: "Needs Review",
      explanation: "Export readiness depends on the preparation plan.",
    };
  }

  if (planSummary.blockers.length > 0) {
    return {
      label: "Export",
      status: "blocked",
      statusLabel: "Blocked",
      explanation: "Resolve plan blockers before export/package steps.",
    };
  }

  if (hasReadyExportStep(planSummary.steps)) {
    return {
      label: "Export",
      status: "ready",
      statusLabel: "Ready",
      explanation: "An export/package step is ready.",
    };
  }

  return {
    label: "Export",
    status: "review",
    statusLabel: "Needs Review",
    explanation: "Export/package readiness still needs review.",
  };
}

function hasReadyPreparationStep(
  steps: NonNullable<
    DatasetReadinessSummary["preparation_plan_summary"]
  >["steps"],
): boolean {
  return steps.some((step) => ["ready", "passed"].includes(step.status));
}

function hasReadyExportStep(
  steps: NonNullable<
    DatasetReadinessSummary["preparation_plan_summary"]
  >["steps"],
): boolean {
  return steps.some((step) => {
    const searchableStepText = normalizeSearchText([
      step.title,
      step.description,
      step.expected_result,
      step.actions,
    ]);

    return (
      ["ready", "passed"].includes(step.status) &&
      (searchableStepText.includes("export") ||
        searchableStepText.includes("package"))
    );
  });
}

function getExportPackageStepTitle(
  steps:
    | NonNullable<
        DatasetReadinessSummary["preparation_plan_summary"]
      >["steps"]
    | undefined,
): string | null {
  if (!steps || steps.length === 0) {
    return null;
  }

  const exportStep = steps.find((step) => {
    const searchableStepText = normalizeSearchText([
      step.title,
      step.description,
      step.expected_result,
      step.actions,
    ]);

    return (
      searchableStepText.includes("export") ||
      searchableStepText.includes("package")
    );
  });

  return exportStep?.title ?? null;
}

type ReportSearchTarget = "datasetReadiness" | "warningSummary";

type ReportSearchIndexItem = {
  name: string;
  sectionKey?: ReportSectionKey;
  target?: ReportSearchTarget;
  text: string;
};

type ReportSearchMatch = {
  name: string;
  sectionKey?: ReportSectionKey;
  target?: ReportSearchTarget;
};

type ReportNavigationItem = {
  label: string;
  sectionKey?: ReportSectionKey;
  targetRef?: RefObject<HTMLDivElement | null>;
};

type ReportSearchIndexInput = {
  allUploadResults: UploadResponse[];
  correctedValidationSummary: CorrectedValidationSummary | null;
  datasetReadinessSummary: DatasetReadinessSummary;
  datasetSession: DatasetSession;
  warningSummary: WarningSummary;
};

function buildReportSearchIndex({
  allUploadResults,
  correctedValidationSummary,
  datasetReadinessSummary,
  datasetSession,
  warningSummary,
}: ReportSearchIndexInput): ReportSearchIndexItem[] {
  return [
    {
      name: "Dataset Readiness Summary",
      target: "datasetReadiness",
      text: normalizeSearchText([
        datasetSession.dataset_session_id,
        datasetSession.file_count,
        datasetReadinessSummary.status,
        datasetReadinessSummary.readiness_score,
        datasetReadinessSummary.summary,
        datasetReadinessSummary.raster_count,
        datasetReadinessSummary.vector_count,
        datasetReadinessSummary.supporting_file_count,
        datasetReadinessSummary.unsupported_file_count,
      ]),
    },
    {
      name: "Corrected Re-upload Validation",
      sectionKey: REPORT_SECTION_KEYS.CORRECTED_VALIDATION,
      text: normalizeSearchText(correctedValidationSummary),
    },
    {
      name: "CRS Review",
      sectionKey: REPORT_SECTION_KEYS.CRS_REVIEW,
      text: normalizeSearchText(datasetReadinessSummary.crs_summary),
    },
    {
      name: "CRS Resolution Guidance",
      sectionKey: REPORT_SECTION_KEYS.CRS_GUIDANCE,
      text: normalizeSearchText(
        datasetReadinessSummary.crs_resolution_guidance_summary,
      ),
    },
    {
      name: "CRS Correction Instructions",
      sectionKey: REPORT_SECTION_KEYS.CRS_CORRECTION,
      text: normalizeSearchText(
        datasetReadinessSummary.crs_correction_instruction_summary,
      ),
    },
    {
      name: "Bounds Review",
      sectionKey: REPORT_SECTION_KEYS.BOUNDS_REVIEW,
      text: normalizeSearchText(datasetReadinessSummary.bounds_summary),
    },
    {
      name: "Raster-Vector Relationship",
      sectionKey: REPORT_SECTION_KEYS.RASTER_VECTOR_RELATIONSHIP,
      text: normalizeSearchText(
        datasetReadinessSummary.raster_vector_relationship_summary,
      ),
    },
    {
      name: "Dataset Task Recommendation",
      sectionKey: REPORT_SECTION_KEYS.TASK_RECOMMENDATION,
      text: normalizeSearchText(
        datasetReadinessSummary.task_recommendation_summary,
      ),
    },
    {
      name: "Dataset Preparation Plan",
      sectionKey: REPORT_SECTION_KEYS.PREPARATION_PLAN,
      text: normalizeSearchText(
        datasetReadinessSummary.preparation_plan_summary,
      ),
    },
    {
      name: "Dataset Issues",
      sectionKey: REPORT_SECTION_KEYS.DATASET_ISSUES,
      text: normalizeSearchText(datasetReadinessSummary.issues),
    },
    {
      name: "Recommended Next Actions",
      sectionKey: REPORT_SECTION_KEYS.DATASET_ISSUES,
      text: normalizeSearchText(datasetReadinessSummary.recommended_actions),
    },
    {
      name: "Uploaded Files Overview / File-Level Analysis",
      sectionKey: REPORT_SECTION_KEYS.FILE_RESULTS,
      text: normalizeSearchText([
        datasetSession.files,
        allUploadResults,
        buildWarningSearchTerms(allUploadResults, warningSummary),
      ]),
    },
    {
      name: "Warning Summary",
      target: "warningSummary",
      text: normalizeSearchText([
        warningSummary,
        allUploadResults,
        buildWarningSearchTerms(allUploadResults, warningSummary),
      ]),
    },
  ];
}

function buildWarningSearchTerms(
  uploadResults: UploadResponse[],
  warningSummary: WarningSummary,
): string[] {
  const warningTerms = uploadResults.flatMap((result) =>
    (result.warnings ?? []).flatMap((warning) => [
      getWarningSummaryFilename(result),
      warning.code,
      warning.severity,
      getWarningImpactCategory(warning.severity || "unknown"),
      warning.message,
      warning.recommended_action,
    ]),
  );

  return [
    "Blocking",
    "Review",
    "Informational",
    warningSummary.impactMessage,
    warningSummary.warningActions.map((action) => [
      action.code,
      action.category,
      action.recommendedAction,
    ]),
    warningSummary.affectedFiles.map((file) => file.filename),
    warningTerms,
  ]
    .flat(3)
    .filter((term): term is string => typeof term === "string");
}

function getReportSearchMatches(
  searchIndex: ReportSearchIndexItem[],
  searchTerm: string,
): ReportSearchMatch[] {
  const normalizedSearchTerm = normalizeSearchText(searchTerm);

  if (!normalizedSearchTerm) {
    return [];
  }

  return searchIndex
    .filter((item) => normalizeSearchText(item.text).includes(normalizedSearchTerm))
    .map((item) => ({
      name: item.name,
      sectionKey: item.sectionKey,
      target: item.target,
    }));
}

function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeSearchText(item)).join(" ");
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => normalizeSearchText(item))
      .join(" ");
  }

  return "";
}

type FileFilterCounts = Record<FileFilter, number>;

type FileFilterTabsProps = {
  counts: FileFilterCounts;
  selectedFilter: FileFilter;
  onSelectFilter: (filter: FileFilter) => void;
};

const FILE_FILTERS: Array<{ key: FileFilter; label: string }> = [
  { key: FILE_FILTER_KEYS.ALL, label: "All" },
  { key: FILE_FILTER_KEYS.RASTER, label: "Raster" },
  { key: FILE_FILTER_KEYS.VECTOR, label: "Vector" },
  { key: FILE_FILTER_KEYS.SUPPORTING, label: "Supporting" },
  { key: FILE_FILTER_KEYS.UNSUPPORTED, label: "Unsupported" },
  { key: FILE_FILTER_KEYS.WARNINGS, label: "Warnings" },
];

function FileFilterTabs({
  counts,
  selectedFilter,
  onSelectFilter,
}: FileFilterTabsProps) {
  return (
    <div className="file-filter-tabs" aria-label="Uploaded file filters">
      {FILE_FILTERS.map((filter) => (
        <button
          className={`file-filter-tab ${
            selectedFilter === filter.key ? "active-file-filter" : ""
          }`}
          key={filter.key}
          onClick={() => onSelectFilter(filter.key)}
          type="button"
        >
          {filter.label} ({counts[filter.key]})
        </button>
      ))}
    </div>
  );
}

function getFileFilterCounts(results: UploadResponse[]): FileFilterCounts {
  return {
    all: results.length,
    raster: results.filter(isRasterFile).length,
    vector: results.filter(isVectorFile).length,
    supporting: results.filter((result) => result.file_category === "supporting")
      .length,
    unsupported: results.filter((result) => result.file_category === "unsupported")
      .length,
    warnings: results.filter((result) => (result.warnings?.length ?? 0) > 0).length,
  };
}

function filterUploadResults(
  results: UploadResponse[],
  selectedFilter: FileFilter,
): UploadResponse[] {
  if (selectedFilter === FILE_FILTER_KEYS.ALL) {
    return results;
  }

  if (selectedFilter === FILE_FILTER_KEYS.RASTER) {
    return results.filter(isRasterFile);
  }

  if (selectedFilter === FILE_FILTER_KEYS.VECTOR) {
    return results.filter(isVectorFile);
  }

  if (selectedFilter === FILE_FILTER_KEYS.SUPPORTING) {
    return results.filter((result) => result.file_category === "supporting");
  }

  if (selectedFilter === FILE_FILTER_KEYS.UNSUPPORTED) {
    return results.filter((result) => result.file_category === "unsupported");
  }

  return results.filter((result) => (result.warnings?.length ?? 0) > 0);
}

function isRasterFile(result: UploadResponse): boolean {
  return result.file_category === "raster" || getGisType(result) === "raster";
}

function isVectorFile(result: UploadResponse): boolean {
  return result.file_category === "vector" || getGisType(result) === "vector";
}

type WarningSummaryCount = {
  label: string;
  count: number;
};

type WarningSummaryFile = {
  filename: string;
  count: number;
};

type WarningActionSummary = {
  code: string;
  recommendedAction: string;
  affectedFileCount: number;
  category: string;
};

type WarningSummary = {
  totalWarnings: number;
  filesWithWarnings: number;
  blockingWarnings: number;
  reviewWarnings: number;
  informationalWarnings: number;
  impactMessage: string;
  warningActions: WarningActionSummary[];
  severityCounts: WarningSummaryCount[];
  codeCounts: WarningSummaryCount[];
  affectedFiles: WarningSummaryFile[];
};

function buildWarningSummary(results: UploadResponse[]): WarningSummary {
  const severityCounts = new Map<string, number>();
  const codeCounts = new Map<string, number>();
  const warningActionCounts = new Map<string, WarningActionSummary>();
  const warningActionFiles = new Map<string, Set<string>>();
  const affectedFiles: WarningSummaryFile[] = [];
  let totalWarnings = 0;
  let blockingWarnings = 0;
  let reviewWarnings = 0;
  let informationalWarnings = 0;

  results.forEach((result) => {
    const warnings = result.warnings ?? [];
    const filename = getWarningSummaryFilename(result);

    if (warnings.length > 0) {
      affectedFiles.push({
        filename,
        count: warnings.length,
      });
    }

    warnings.forEach((warning) => {
      const severity = warning.severity || "unknown";
      const code = warning.code || "UNKNOWN_WARNING";
      const recommendedAction =
        warning.recommended_action || "Review this warning before continuing.";
      const warningActionKey = `${code}::${recommendedAction}`;

      totalWarnings += 1;
      if (severity === "error") {
        blockingWarnings += 1;
      } else if (severity === "warning") {
        reviewWarnings += 1;
      } else {
        informationalWarnings += 1;
      }

      severityCounts.set(severity, (severityCounts.get(severity) ?? 0) + 1);
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);

      if (!warningActionFiles.has(warningActionKey)) {
        warningActionFiles.set(warningActionKey, new Set<string>());
      }

      warningActionFiles.get(warningActionKey)?.add(filename);
      warningActionCounts.set(warningActionKey, {
        code,
        recommendedAction,
        affectedFileCount: warningActionFiles.get(warningActionKey)?.size ?? 1,
        category: getWarningImpactCategory(severity),
      });
    });
  });

  return {
    totalWarnings,
    filesWithWarnings: affectedFiles.length,
    blockingWarnings,
    reviewWarnings,
    informationalWarnings,
    impactMessage: buildWarningImpactMessage(
      blockingWarnings,
      Array.from(codeCounts.keys()),
    ),
    warningActions: Array.from(warningActionCounts.values()),
    severityCounts: mapCountsToList(severityCounts),
    codeCounts: mapCountsToList(codeCounts),
    affectedFiles,
  };
}

function getWarningImpactCategory(severity: string): string {
  if (severity === "error") {
    return "Blocking";
  }

  if (severity === "warning") {
    return "Needs review";
  }

  return "Informational";
}

function buildWarningImpactMessage(
  blockingWarnings: number,
  warningCodes: string[],
): string {
  if (blockingWarnings > 0) {
    if (warningCodes.includes("INCOMPLETE_SHAPEFILE")) {
      return "Upload input is blocked until required shapefile sidecars are provided.";
    }

    return "Upload input is blocked until required file issues are fixed.";
  }

  return "Warnings do not block preparation, but should be reviewed before model training.";
}

type WarningSummaryExport = {
  total_warnings: number;
  files_with_warnings: number;
  blocking_warnings: number;
  review_warnings: number;
  informational_warnings: number;
  impact_message: string;
  warning_actions: Array<{
    code: string;
    recommended_action: string;
    affected_file_count: number;
    category: string;
  }>;
};

function buildWarningSummaryExport(
  warningSummary: WarningSummary,
): WarningSummaryExport {
  return {
    total_warnings: warningSummary.totalWarnings,
    files_with_warnings: warningSummary.filesWithWarnings,
    blocking_warnings: warningSummary.blockingWarnings,
    review_warnings: warningSummary.reviewWarnings,
    informational_warnings: warningSummary.informationalWarnings,
    impact_message: warningSummary.impactMessage,
    warning_actions: warningSummary.warningActions.map((action) => ({
      code: action.code,
      recommended_action: action.recommendedAction,
      affected_file_count: action.affectedFileCount,
      category: action.category,
    })),
  };
}

function formatWarningImpactMarkdown(warningSummary: WarningSummary): string {
  return [
    "## Warning Impact",
    `- Blocking warnings: ${formatMarkdownValue(warningSummary.blockingWarnings)}`,
    `- Review warnings: ${formatMarkdownValue(warningSummary.reviewWarnings)}`,
    `- Informational warnings: ${formatMarkdownValue(
      warningSummary.informationalWarnings,
    )}`,
    `- Impact: ${formatMarkdownValue(warningSummary.impactMessage)}`,
    "",
    "### Warning Actions",
    formatWarningActionsMarkdown(warningSummary.warningActions),
  ].join("\n");
}

function formatWarningActionsMarkdown(actions: WarningActionSummary[]): string {
  if (actions.length === 0) {
    return "- No warning actions required.";
  }

  return actions
    .map(
      (action) =>
        `- ${formatMarkdownValue(action.code)}: ${formatMarkdownValue(
          action.recommendedAction,
        )} (${formatMarkdownValue(action.affectedFileCount)} affected file(s))`,
    )
    .join("\n");
}

function getWarningSummaryFilename(result: UploadResponse): string {
  return result.original_filename || result.saved_filename || "Unnamed file";
}

function mapCountsToList(counts: Map<string, number>): WarningSummaryCount[] {
  return Array.from(counts.entries()).map(([label, count]) => ({
    label,
    count,
  }));
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
            {formatStatusLabel(readinessReport.status)}
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

function buildReportDownloadFilename(
  datasetSession: DatasetSession,
  datasetReadinessSummary: DatasetReadinessSummary,
  extension: "json" | "md",
): string {
  const sessionId = datasetSession.dataset_session_id;
  const statusSlug = sanitizeFilenamePart(datasetReadinessSummary.status);
  const shortSessionId = sanitizeFilenamePart(sessionId).slice(0, 8);

  if (!statusSlug || !shortSessionId) {
    return `geoprep_dataset_report_${sessionId}.${extension}`;
  }

  return `geoprep_report_${statusSlug}_${shortSessionId}.${extension}`;
}

function sanitizeFilenamePart(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatCodeValue(value: string): string {
  return formatStatusLabel(value);
}

function formatCodeList(values: string[]): string {
  return values.map((value) => formatCodeValue(value)).join(", ");
}

function formatStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return "Not available";
  }

  const statusLabels: Record<string, string> = {
    blocked_input: "Blocked by upload input",
    blocked_by_input: "Blocked by upload input",
    needs_crs_review: "Needs CRS review",
    mixed_crs: "Mixed CRS",
    missing_crs: "Missing CRS",
    unresolved_crs: "Unresolved CRS",
    consistent_crs: "CRS consistent",
    raster_only: "Raster-only workflow",
    vector_only: "Vector-only workflow",
    single_spatial_file: "Single spatial file",
    overlapping_bounds: "Bounds overlap",
    no_spatial_overlap: "No spatial overlap",
    candidate_geoai_dataset: "Candidate GeoAI dataset",
    no_raster_vector_pair: "No raster-vector pair",
    blocked_by_crs_review: "Blocked by CRS review",
    blocked_by_bounds_review: "Blocked by bounds review",
    blocked_by_relationship_review: "Blocked by relationship review",
    task_candidate: "Task candidate",
    fix_upload_input: "Fix upload input",
    plan_blocked: "Plan blocked",
    plan_needs_review: "Plan needs review",
    plan_ready: "Plan ready",
    inspection_failed: "Inspection failed",
    ready: "Ready",
    passed: "Passed",
    blocked: "Blocked",
    required: "Required",
    planned: "Planned",
    low: "Low",
    medium: "Medium",
    high: "High",
    raster: "Raster",
    vector: "Vector",
    supporting: "Supporting",
    unsupported: "Unsupported",
    "non-gis": "Non-GIS",
    unknown: "Unknown",
  };

  return (
    statusLabels[value] ??
    value
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatReportPreviewComposition(
  datasetReadinessSummary: DatasetReadinessSummary,
): string {
  return [
    `${datasetReadinessSummary.raster_count} raster`,
    `${datasetReadinessSummary.vector_count} vector`,
    `${datasetReadinessSummary.supporting_file_count} supporting`,
    `${datasetReadinessSummary.unsupported_file_count} unsupported`,
  ].join(", ");
}

function formatReportPreviewTask(
  taskRecommendationSummary:
    | DatasetReadinessSummary["task_recommendation_summary"]
    | undefined,
): string {
  if (!taskRecommendationSummary?.recommended_task) {
    return "Not available";
  }

  return formatCodeValue(taskRecommendationSummary.recommended_task);
}

function formatReportPreviewStep(
  steps: Array<{ title: string; status: string }> | undefined,
): string {
  if (!steps || steps.length === 0) {
    return "Not available";
  }

  return getFirstActionableStepTitle(steps);
}

type ReportQualityBadge = {
  status: "blocked" | "needs-review" | "ready";
  label: string;
  reason: string;
};

type CrsBlockingInput = {
  datasetStatus?: string;
  crsStatus?: string;
  correctedValidationStatus?: string;
};

function hasCrsBlockingIssue({
  datasetStatus,
  crsStatus,
  correctedValidationStatus,
}: CrsBlockingInput): boolean {
  return (
    datasetStatus === "needs_crs_review" ||
    ["mixed_crs", "missing_crs", "unresolved_crs"].includes(crsStatus ?? "") ||
    correctedValidationStatus === "blocked"
  );
}

type PlainTextReportSummaryInput = {
  datasetSession: DatasetSession;
  datasetReadinessSummary: DatasetReadinessSummary;
  reportQualityBadge: ReportQualityBadge | null;
  allUploadResults: UploadResponse[];
  exportPackageReadiness: ExportPackageReadiness | null;
};

function buildPlainTextReportSummary({
  datasetSession,
  datasetReadinessSummary,
  reportQualityBadge,
  allUploadResults,
  exportPackageReadiness,
}: PlainTextReportSummaryInput): string {
  return [
    "GeoPrep AI Dataset Summary",
    "",
    `Dataset session ID: ${formatPlainTextValue(datasetSession.dataset_session_id)}`,
    `Status: ${formatPlainTextValue(datasetReadinessSummary.status)}`,
    `Quality: ${formatPlainTextValue(reportQualityBadge?.label)}`,
    `Reason: ${formatPlainTextValue(reportQualityBadge?.reason)}`,
    `Readiness: ${formatPlainTextValue(datasetReadinessSummary.readiness_score)}/100`,
    `Composition: ${formatReportPreviewComposition(datasetReadinessSummary)}`,
    `Source types: ${formatSourceTypeSummary(allUploadResults)}`,
    `Export package: ${formatExportPackagePlainTextSummary(
      exportPackageReadiness,
    )}`,
    `Recommended task: ${formatReportPreviewTask(
      datasetReadinessSummary.task_recommendation_summary,
    )}`,
    `First actionable step: ${formatReportPreviewStep(
      datasetReadinessSummary.preparation_plan_summary?.steps,
    )}`,
    "",
    "Main issues:",
    formatPlainTextList(
      datasetReadinessSummary.issues,
      "No dataset-level issues detected.",
    ),
    "",
    "Recommended next actions:",
    formatPlainTextList(
      datasetReadinessSummary.recommended_actions,
      "No immediate dataset-level actions required.",
    ),
  ].join("\n");
}

function buildReportQualityBadge(
  datasetReadinessSummary: DatasetReadinessSummary,
): ReportQualityBadge {
  const crsStatus = datasetReadinessSummary.crs_summary?.status;
  const boundsStatus = datasetReadinessSummary.bounds_summary?.status;
  const taskStatus = datasetReadinessSummary.task_recommendation_summary?.status;
  const planStatus = datasetReadinessSummary.preparation_plan_summary?.status;
  const blockers =
    datasetReadinessSummary.preparation_plan_summary?.blockers ?? [];
  const isCrsBlocked =
    datasetReadinessSummary.status === "needs_crs_review" ||
    ["mixed_crs", "missing_crs", "unresolved_crs"].includes(crsStatus ?? "");

  if (datasetReadinessSummary.status === "blocked_input") {
    return {
      status: "blocked",
      label: "Blocked",
      reason: "One or more files cannot continue to dataset checks.",
    };
  }

  if (isCrsBlocked || blockers.length > 0) {
    return {
      status: "blocked",
      label: "Blocked",
      reason: "CRS issues must be resolved before preparation can continue.",
    };
  }

  if (
    datasetReadinessSummary.status === "raster_only" ||
    datasetReadinessSummary.raster_vector_relationship_summary?.status ===
      "raster_only"
  ) {
    return {
      status: "needs-review",
      label: "Needs Review",
      reason:
        "Raster-only workflow. Add labels if supervised GeoAI training is required.",
    };
  }

  if (
    datasetReadinessSummary.status === "vector_only" ||
    datasetReadinessSummary.raster_vector_relationship_summary?.status ===
      "vector_only"
  ) {
    return {
      status: "needs-review",
      label: "Needs Review",
      reason:
        "Vector-only workflow. Add raster imagery if labels should be matched to imagery.",
    };
  }

  if (boundsStatus === "single_spatial_file" || planStatus === "plan_needs_review") {
    return {
      status: "needs-review",
      label: "Needs Review",
      reason: "Some preparation checks still need review.",
    };
  }

  if (crsStatus === "consistent_crs" && taskStatus === "task_candidate") {
    return {
      status: "ready",
      label: "Ready for Preparation",
      reason: "Dataset checks are ready for task-specific preparation.",
    };
  }

  return {
    status: "needs-review",
    label: "Needs Review",
    reason: "Some preparation checks still need review.",
  };
}

function buildMvpReadinessSnapshot(
  datasetReadinessSummary: DatasetReadinessSummary,
  reportQualityBadge: ReportQualityBadge | null,
  exportPackageReadiness: ExportPackageReadiness,
): MvpReadinessSnapshot {
  if (datasetReadinessSummary.status === "blocked_input") {
    return {
      datasetUsability: "Blocked",
      mainLabel: "Main blocker",
      mainMessage: "Upload input issue",
      bestNextAction:
        datasetReadinessSummary.recommended_actions[0] ??
        "Fix upload input issues, then upload again.",
      taskDirection: "Fix upload input first",
      exportPackageState: exportPackageReadiness.statusLabel,
    };
  }

  if (
    datasetReadinessSummary.status === "needs_crs_review" ||
    ["mixed_crs", "missing_crs", "unresolved_crs"].includes(
      datasetReadinessSummary.crs_summary?.status ?? "",
    )
  ) {
    return {
      datasetUsability: "Blocked",
      mainLabel: "Main blocker",
      mainMessage: "CRS mismatch or CRS review required",
      bestNextAction:
        datasetReadinessSummary.recommended_actions[0] ??
        "Reproject or confirm CRS, then re-upload corrected files.",
      taskDirection: "Blocked until CRS is resolved",
      exportPackageState: exportPackageReadiness.statusLabel,
    };
  }

  if (datasetReadinessSummary.status === "raster_only") {
    return {
      datasetUsability: reportQualityBadge?.label ?? "Needs Review",
      mainLabel: "Main note",
      mainMessage:
        "Raster-only workflow. Add labels if supervised GeoAI training is required.",
      bestNextAction:
        "Continue with raster tiling, statistics, and imagery-only preparation.",
      taskDirection: formatReportPreviewTask(
        datasetReadinessSummary.task_recommendation_summary,
      ),
      exportPackageState: exportPackageReadiness.statusLabel,
    };
  }

  if (datasetReadinessSummary.status === "vector_only") {
    return {
      datasetUsability: reportQualityBadge?.label ?? "Needs Review",
      mainLabel: "Main note",
      mainMessage:
        "Vector-only workflow. Add raster imagery if image-based GeoAI training is required.",
      bestNextAction:
        "Continue with vector cleanup, attributes, and task-specific preparation.",
      taskDirection: formatReportPreviewTask(
        datasetReadinessSummary.task_recommendation_summary,
      ),
      exportPackageState: exportPackageReadiness.statusLabel,
    };
  }

  return {
    datasetUsability: reportQualityBadge?.label ?? "Ready for Preparation",
    mainLabel: reportQualityBadge?.status === "ready" ? "Main note" : "Main blocker",
    mainMessage:
      reportQualityBadge?.reason ??
      "Dataset checks are ready for task-specific preparation.",
    bestNextAction:
      datasetReadinessSummary.recommended_actions[0] ??
      exportPackageReadiness.nextAction,
    taskDirection: formatReportPreviewTask(
      datasetReadinessSummary.task_recommendation_summary,
    ),
    exportPackageState: exportPackageReadiness.statusLabel,
  };
}

function formatPlainTextList(items: string[], emptyText: string): string {
  if (items.length === 0) {
    return `- ${emptyText}`;
  }

  return items.map((item) => `- ${formatPlainTextValue(item)}`).join("\n");
}

function formatPlainTextValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  return String(value).replace(/\s+/g, " ").trim();
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
    ...getSourceMetadataItems(metadata, result.original_filename),
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

type UploadSourceMetadata = {
  source_upload_type: string;
  original_uploaded_filename: string;
  logical_dataset_filename: string;
  source_package_name?: string;
  shapefile_sidecars?: unknown[];
};

type SourceTypeCounts = {
  direct_upload: number;
  shapefile_sidecar_group: number;
  zip_shapefile_package: number;
};

function getUploadSourceMetadata(result: UploadResponse): UploadSourceMetadata {
  const metadata = result.gis_metadata?.metadata as Record<string, unknown> | null;

  return buildUploadSourceMetadata(metadata, result.original_filename);
}

function buildUploadSourceMetadata(
  metadata: Record<string, unknown> | null,
  fallbackFilename: string,
): UploadSourceMetadata {
  const sourceUploadType =
    typeof metadata?.source_upload_type === "string"
      ? metadata.source_upload_type
      : "direct_upload";
  const originalUploadedFilename =
    typeof metadata?.original_uploaded_filename === "string"
      ? metadata.original_uploaded_filename
      : fallbackFilename;
  const logicalDatasetFilename =
    typeof metadata?.logical_dataset_filename === "string"
      ? metadata.logical_dataset_filename
      : fallbackFilename;
  const sourceMetadata: UploadSourceMetadata = {
    source_upload_type: sourceUploadType,
    original_uploaded_filename: originalUploadedFilename,
    logical_dataset_filename: logicalDatasetFilename,
  };

  if (typeof metadata?.source_package_name === "string") {
    sourceMetadata.source_package_name = metadata.source_package_name;
  }

  if (Array.isArray(metadata?.shapefile_sidecars)) {
    sourceMetadata.shapefile_sidecars = metadata.shapefile_sidecars;
  }

  return sourceMetadata;
}

function getSourceMetadataItems(
  metadata: Record<string, unknown> | null,
  fallbackFilename: string,
): Array<{ label: string; value: string }> {
  const sourceMetadata = buildUploadSourceMetadata(metadata, fallbackFilename);
  const sourceUploadType = sourceMetadata.source_upload_type;
  const items: Array<{ label: string; value: string }> = [
    {
      label: "Source upload type",
      value: formatSourceUploadType(sourceUploadType),
    },
  ];

  if (sourceMetadata.source_package_name) {
    items.push({
      label: "Source package",
      value: sourceMetadata.source_package_name,
    });
  }

  if (sourceUploadType !== "direct_upload") {
    items.push({
      label: "Logical GIS file",
      value: sourceMetadata.logical_dataset_filename,
    });
  }

  const includedShapefileFiles = formatIncludedShapefileFiles(
    sourceMetadata.logical_dataset_filename,
    sourceMetadata.shapefile_sidecars,
  );

  if (includedShapefileFiles) {
    items.push({
      label: "Included shapefile files",
      value: includedShapefileFiles,
    });
  }

  return items;
}

function formatSourceUploadType(sourceUploadType: string): string {
  if (sourceUploadType === "zip_shapefile_package") {
    return "ZIP shapefile package";
  }

  if (sourceUploadType === "shapefile_sidecar_group") {
    return "Shapefile sidecar group";
  }

  return "Direct upload";
}

function getSourceTypeCounts(uploadResults: UploadResponse[]): SourceTypeCounts {
  return uploadResults.reduce<SourceTypeCounts>(
    (counts, result) => {
      const sourceUploadType = getUploadSourceMetadata(result).source_upload_type;

      if (sourceUploadType === "zip_shapefile_package") {
        counts.zip_shapefile_package += 1;
        return counts;
      }

      if (sourceUploadType === "shapefile_sidecar_group") {
        counts.shapefile_sidecar_group += 1;
        return counts;
      }

      counts.direct_upload += 1;
      return counts;
    },
    {
      direct_upload: 0,
      shapefile_sidecar_group: 0,
      zip_shapefile_package: 0,
    },
  );
}

function formatSourceTypeSummary(uploadResults: UploadResponse[]): string {
  const counts = getSourceTypeCounts(uploadResults);

  return [
    `Direct uploads: ${counts.direct_upload}`,
    `Shapefile groups: ${counts.shapefile_sidecar_group}`,
    `ZIP packages: ${counts.zip_shapefile_package}`,
  ].join(", ");
}

function formatIncludedShapefileFiles(
  logicalDatasetFilename: string,
  shapefileSidecars: unknown,
): string | null {
  if (!Array.isArray(shapefileSidecars) || shapefileSidecars.length === 0) {
    return null;
  }

  const includedExtensions = new Set<string>();
  const logicalExtension = getFileExtension(logicalDatasetFilename);

  if (logicalExtension) {
    includedExtensions.add(logicalExtension);
  }

  shapefileSidecars.forEach((sidecar) => {
    if (!sidecar || typeof sidecar !== "object") {
      return;
    }

    const sidecarRecord = sidecar as Record<string, unknown>;
    const fileExtension = sidecarRecord.file_extension;
    const originalFilename = sidecarRecord.original_filename;

    if (typeof fileExtension === "string") {
      includedExtensions.add(fileExtension.toLowerCase());
      return;
    }

    if (typeof originalFilename === "string") {
      const extension = getFileExtension(originalFilename);

      if (extension) {
        includedExtensions.add(extension);
      }
    }
  });

  return Array.from(includedExtensions).join(", ");
}

type MarkdownReportInput = {
  datasetSession: DatasetSession;
  datasetReadinessSummary: DatasetReadinessSummary;
  correctedValidationSummary: CorrectedValidationSummary | null;
  allUploadResults: UploadResponse[];
  exportPackageReadiness: ExportPackageReadiness | null;
  warningSummary: WarningSummary;
};

function buildMarkdownReport({
  datasetSession,
  datasetReadinessSummary,
  correctedValidationSummary,
  allUploadResults,
  exportPackageReadiness,
  warningSummary,
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
    formatWarningImpactMarkdown(warningSummary),
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

  lines.push(
    "",
    formatExportPackageReadinessMarkdown(exportPackageReadiness),
  );

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

  if (
    datasetStatus === "blocked_input" ||
    [
      normalizedCrsStatus,
      normalizedBoundsStatus,
      normalizedRelationshipStatus,
      normalizedTaskStatus,
    ].includes("blocked_by_input")
  ) {
    return {
      status: "blocked",
      summary:
        "Corrected re-upload validation is blocked because one or more uploaded files cannot continue to dataset checks. Fix the upload input issues, then upload again.",
      crsStatus: normalizedCrsStatus,
      boundsStatus: normalizedBoundsStatus,
      relationshipStatus: normalizedRelationshipStatus,
      taskStatus: normalizedTaskStatus,
      checks: [
        "Upload input validation has not passed yet.",
        "CRS, bounds, raster-vector relationship, task, and preparation checks should not be trusted until upload input issues are fixed.",
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

function normalizeStepTitle(title: string): string {
  return title.trim().toLowerCase();
}

function getFirstActionableStepTitle(
  steps: Array<{ title: string; status: string }>,
): string {
  const actionableStep = steps.find((step) =>
    ["required", "blocked", "ready", "planned"].includes(step.status),
  );

  return actionableStep?.title ?? steps[0]?.title ?? "Not available";
}

function isBlockedByInputStatus(status: string | undefined): boolean {
  return status === "blocked_by_input" || status === "blocked_input";
}

function getCrsGroupsEmptyText(status: string): string {
  if (isBlockedByInputStatus(status)) {
    return "No CRS groups are available until upload input issues are fixed.";
  }

  return "No CRS groups are needed for this dataset right now.";
}

function getCrsGuidanceEmptyText(status: string): string {
  if (isBlockedByInputStatus(status)) {
    return "No per-file CRS guidance is available until files can be inspected.";
  }

  return "No per-file CRS guidance is needed for the current dataset.";
}

function getFilesToReprojectEmptyText(status: string): string {
  if (isBlockedByInputStatus(status)) {
    return "No reprojection list is available until upload input issues are fixed.";
  }

  return "No files currently need reprojection.";
}

function getFilesToConfirmEmptyText(status: string): string {
  if (isBlockedByInputStatus(status)) {
    return "No CRS confirmation list is available until files can be inspected.";
  }

  return "No files currently need CRS confirmation.";
}

function getToolInstructionEmptyText(title: string, status: string): string {
  if (isBlockedByInputStatus(status)) {
    return `${title} CRS correction steps are not available until upload input issues are fixed.`;
  }

  if (title === "Python / GeoPandas") {
    return "No Python CRS correction steps are needed for this dataset.";
  }

  return `No ${title} CRS correction steps are needed for this dataset.`;
}

type ToolInstructionCardProps = {
  emptyText: string;
  title: string;
  steps: string[];
};

function ToolInstructionCard({
  emptyText,
  title,
  steps,
}: ToolInstructionCardProps) {
  return (
    <div className="tool-instruction-card">
      <h5>{title}</h5>

      {steps.length === 0 ? (
        <p className="small-muted">{emptyText}</p>
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
