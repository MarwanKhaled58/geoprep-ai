def generate_dataset_task_recommendation_summary(
    relationship_summary: dict,
    crs_status: str,
    bounds_status: str,
) -> dict:
    """
    Generate dataset-level GeoAI task recommendations.

    V1 purpose:
    - Convert raster/vector relationship into possible GeoAI task suggestions.
    - Respect blockers from CRS and bounds checks.
    - Avoid claiming the dataset is training-ready too early.
    """

    relationship_type = relationship_summary.get("relationship_type", "unknown")
    vector_role = relationship_summary.get("vector_role", "unknown_vector_role")
    relationship_status = relationship_summary.get("status", "relationship_needs_review")

    blockers = _detect_task_blockers(
        crs_status=crs_status,
        bounds_status=bounds_status,
        relationship_status=relationship_status,
    )

    recommended_task = _infer_recommended_task(
        relationship_type=relationship_type,
        vector_role=vector_role,
    )

    confidence = _infer_confidence(
        blockers=blockers,
        relationship_type=relationship_type,
        vector_role=vector_role,
    )

    readiness_status = _infer_task_readiness_status(
        blockers=blockers,
        recommended_task=recommended_task,
    )

    summary = _build_task_summary(
        readiness_status=readiness_status,
        recommended_task=recommended_task,
        blockers=blockers,
    )

    return {
        "status": readiness_status,
        "summary": summary,
        "recommended_task": recommended_task,
        "confidence": confidence,
        "blockers": blockers,
        "inputs_used": {
            "relationship_status": relationship_status,
            "relationship_type": relationship_type,
            "vector_role": vector_role,
            "crs_status": crs_status,
            "bounds_status": bounds_status,
        },
        "issues": _build_task_issues(blockers),
        "recommended_actions": _build_task_recommended_actions(
            recommended_task=recommended_task,
            blockers=blockers,
            vector_role=vector_role,
        ),
    }


def _detect_task_blockers(
    crs_status: str,
    bounds_status: str,
    relationship_status: str,
) -> list[str]:
    """
    Detect blockers preventing task-ready GeoAI preparation.
    """

    blockers: list[str] = []

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        blockers.append("crs_review_required")

    if bounds_status in {
        "missing_bounds",
        "blocked_by_crs_review",
        "no_spatial_overlap",
        "partial_spatial_overlap",
    }:
        blockers.append("bounds_review_required")

    if relationship_status in {
        "blocked_by_crs_review",
        "blocked_by_bounds_review",
        "relationship_needs_review",
    }:
        blockers.append("relationship_review_required")

    return _deduplicate_text_items(blockers)


def _infer_recommended_task(relationship_type: str, vector_role: str) -> str:
    """
    Infer likely GeoAI task from relationship type and vector role.
    """

    if relationship_type == "raster_to_point_annotations":
        return "point_based_object_detection_or_sample_extraction"

    if relationship_type == "raster_to_segmentation_labels":
        return "semantic_or_instance_segmentation"

    if relationship_type == "raster_to_linear_features":
        return "linear_feature_extraction"

    if relationship_type == "raster_to_mixed_vector_annotations":
        return "mixed_geoai_annotation_workflow"

    if relationship_type == "imagery_only":
        return "raster_preparation_or_unsupervised_analysis"

    if relationship_type == "labels_or_gis_only":
        return "vector_quality_review_or_label_preparation"

    if vector_role == "point_annotations":
        return "point_based_object_detection_or_sample_extraction"

    if vector_role == "polygon_labels":
        return "semantic_or_instance_segmentation"

    if vector_role == "linear_features":
        return "linear_feature_extraction"

    return "task_needs_manual_review"


def _infer_confidence(
    blockers: list[str],
    relationship_type: str,
    vector_role: str,
) -> str:
    """
    Estimate confidence of the task recommendation.
    """

    if relationship_type == "none" or vector_role == "none":
        return "low"

    if blockers:
        return "medium"

    if relationship_type in {
        "raster_to_point_annotations",
        "raster_to_segmentation_labels",
        "raster_to_linear_features",
    }:
        return "high"

    return "medium"


def _infer_task_readiness_status(
    blockers: list[str],
    recommended_task: str,
) -> str:
    """
    Infer task recommendation readiness status.
    """

    if recommended_task == "task_needs_manual_review":
        return "task_needs_review"

    if "crs_review_required" in blockers:
        return "blocked_by_crs_review"

    if "bounds_review_required" in blockers:
        return "blocked_by_bounds_review"

    if "relationship_review_required" in blockers:
        return "blocked_by_relationship_review"

    return "task_candidate"


def _build_task_summary(
    readiness_status: str,
    recommended_task: str,
    blockers: list[str],
) -> str:
    """
    Build human-readable task recommendation summary.
    """

    task_label = recommended_task.replace("_", " ")

    if readiness_status == "task_candidate":
        return (
            f"GeoPrep AI recommends '{task_label}' as a candidate GeoAI task. "
            "The dataset still needs detailed alignment and label quality checks before export."
        )

    if blockers:
        blocker_label = ", ".join(blocker.replace("_", " ") for blocker in blockers)

        return (
            f"GeoPrep AI detected a possible '{task_label}' workflow, but task preparation "
            f"is blocked by: {blocker_label}."
        )

    return (
        "GeoPrep AI could not confidently recommend a GeoAI task from the current dataset."
    )


def _build_task_issues(blockers: list[str]) -> list[str]:
    """
    Build task recommendation issues from blockers.
    """

    issues: list[str] = []

    if "crs_review_required" in blockers:
        issues.append("Task recommendation is blocked until CRS issues are resolved.")

    if "bounds_review_required" in blockers:
        issues.append("Task recommendation requires bounds and spatial overlap review.")

    if "relationship_review_required" in blockers:
        issues.append("Raster-vector relationship needs review before task preparation.")

    return issues


def _build_task_recommended_actions(
    recommended_task: str,
    blockers: list[str],
    vector_role: str,
) -> list[str]:
    """
    Build recommended actions for the task recommendation.
    """

    actions: list[str] = []

    if "crs_review_required" in blockers:
        actions.append("Resolve CRS issues before preparing this dataset for a GeoAI task.")

    if "bounds_review_required" in blockers:
        actions.append("Review spatial bounds and overlap after CRS issues are resolved.")

    if "relationship_review_required" in blockers:
        actions.append("Confirm raster-vector relationship before generating labels, masks, or training samples.")

    if recommended_task == "point_based_object_detection_or_sample_extraction":
        actions.append(
            "After CRS and alignment checks, validate that point annotations fall inside the raster extent."
        )
        actions.append(
            "Prepare point labels as object centers, sample locations, or detection annotations depending on the target model."
        )

    if recommended_task == "semantic_or_instance_segmentation":
        actions.append(
            "After CRS and alignment checks, prepare polygons for mask generation or segmentation labels."
        )

    if recommended_task == "linear_feature_extraction":
        actions.append(
            "After CRS and alignment checks, prepare line features for linear feature extraction."
        )

    if recommended_task == "mixed_geoai_annotation_workflow":
        actions.append(
            "Separate vector layers by geometry type and map each layer to its intended GeoAI task."
        )

    if recommended_task == "raster_preparation_or_unsupervised_analysis":
        actions.append(
            "Continue with raster tiling, statistics, and imagery-only preparation."
        )

    if recommended_task == "vector_quality_review_or_label_preparation":
        actions.append(
            "Continue with vector geometry validation, attribute review, and label schema preparation."
        )

    if not actions:
        actions.append("Review the dataset manually to decide the correct GeoAI task.")

    return _deduplicate_text_items(actions)


def _deduplicate_text_items(items: list[str]) -> list[str]:
    """
    Remove duplicate text items while preserving order.
    """

    deduplicated = []

    for item in items:
        if item not in deduplicated:
            deduplicated.append(item)

    return deduplicated
    