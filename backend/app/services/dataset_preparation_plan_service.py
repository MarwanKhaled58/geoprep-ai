def generate_dataset_preparation_plan_summary(
    dataset_status: str,
    crs_summary: dict,
    crs_resolution_guidance_summary: dict,
    bounds_summary: dict,
    raster_vector_relationship_summary: dict,
    task_recommendation_summary: dict,
) -> dict:
    """
    Generate a practical dataset preparation plan.

    Part 18 purpose:
    - Convert analysis summaries into ordered preparation steps.
    - Explain current blockers.
    - Confirm corrected re-upload validation when CRS, bounds, and relationship pass.
    - Give the user a clear next workflow.
    """

    blockers = _detect_plan_blockers(
        crs_summary=crs_summary,
        bounds_summary=bounds_summary,
        raster_vector_relationship_summary=raster_vector_relationship_summary,
        task_recommendation_summary=task_recommendation_summary,
    )

    steps = _build_preparation_steps(
        crs_summary=crs_summary,
        crs_resolution_guidance_summary=crs_resolution_guidance_summary,
        bounds_summary=bounds_summary,
        raster_vector_relationship_summary=raster_vector_relationship_summary,
        task_recommendation_summary=task_recommendation_summary,
        blockers=blockers,
    )

    status = _resolve_plan_status(
        dataset_status=dataset_status,
        blockers=blockers,
        steps=steps,
    )

    return {
        "status": status,
        "summary": _build_plan_summary(
            status=status,
            blockers=blockers,
            step_count=len(steps),
        ),
        "blockers": blockers,
        "steps": steps,
        "recommended_actions": _build_plan_recommended_actions(
            status=status,
            blockers=blockers,
            steps=steps,
        ),
    }


def _detect_plan_blockers(
    crs_summary: dict,
    bounds_summary: dict,
    raster_vector_relationship_summary: dict,
    task_recommendation_summary: dict,
) -> list[str]:
    """
    Detect high-level blockers for dataset preparation.
    """

    blockers: list[str] = []

    crs_status = crs_summary.get("status")
    bounds_status = bounds_summary.get("status")
    relationship_status = raster_vector_relationship_summary.get("status")
    task_status = task_recommendation_summary.get("status")

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        blockers.append("crs_resolution_required")

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
        blockers.append("raster_vector_relationship_review_required")

    if task_status in {
        "blocked_by_crs_review",
        "blocked_by_bounds_review",
        "blocked_by_relationship_review",
        "task_needs_review",
    }:
        blockers.append("task_preparation_blocked")

    return _deduplicate_text_items(blockers)


def _build_preparation_steps(
    crs_summary: dict,
    crs_resolution_guidance_summary: dict,
    bounds_summary: dict,
    raster_vector_relationship_summary: dict,
    task_recommendation_summary: dict,
    blockers: list[str],
) -> list[dict]:
    """
    Build ordered dataset preparation steps.
    """

    steps: list[dict] = []

    crs_status = crs_summary.get("status")
    bounds_status = bounds_summary.get("status")
    relationship_status = raster_vector_relationship_summary.get("status")
    relationship_type = raster_vector_relationship_summary.get("relationship_type")
    recommended_task = task_recommendation_summary.get("recommended_task")
    task_status = task_recommendation_summary.get("status")
    target_crs = crs_resolution_guidance_summary.get("recommended_target_crs")

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        steps.append(
            _create_step(
                order=1,
                title="Resolve CRS",
                status="required",
                description=(
                    "Resolve CRS issues before spatial comparison or GeoAI preparation."
                ),
                expected_result="All spatial files have one confirmed target CRS.",
                actions=crs_resolution_guidance_summary.get(
                    "recommended_actions",
                    [],
                ),
            )
        )

    if target_crs and crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Reproject dataset to target CRS",
                status="required",
                description=(
                    "Prepare all raster and vector files in the recommended "
                    f"target CRS: {target_crs}."
                ),
                expected_result=(
                    f"All spatial files are confirmed or reprojected to {target_crs}."
                ),
                actions=[
                    (
                        f"Use {target_crs} as the working CRS unless project "
                        "requirements specify another CRS."
                    ),
                    "Reproject files that do not match the target CRS.",
                    "Re-upload or re-run inspection after CRS correction.",
                ],
            )
        )

    if crs_status == "consistent_crs":
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Validate corrected CRS",
                status="passed",
                description=(
                    "Corrected re-upload validation confirmed that spatial files "
                    "now use one comparable CRS."
                ),
                expected_result="CRS is consistent across raster and vector files.",
                actions=crs_summary.get("recommended_actions", []),
            )
        )

    if bounds_status in {
        "blocked_by_crs_review",
        "missing_bounds",
        "no_spatial_overlap",
        "partial_spatial_overlap",
    }:
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Re-run bounds and overlap review",
                status="blocked",
                description=(
                    "Bounds review should be repeated after CRS issues are resolved."
                ),
                expected_result=(
                    "Raster and vector bounds overlap correctly in the same CRS."
                ),
                actions=[
                    "Re-run dataset upload/inspection after CRS correction.",
                    "Confirm that raster and vector files represent the same project area.",
                    "If bounds still do not overlap, check source files or project CRS.",
                ],
            )
        )

    if bounds_status == "overlapping_bounds":
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Validate bounds overlap",
                status="passed",
                description=(
                    "Corrected re-upload validation confirmed that raster and vector "
                    "bounds overlap."
                ),
                expected_result=(
                    "Raster and vector files represent overlapping spatial coverage."
                ),
                actions=bounds_summary.get("recommended_actions", []),
            )
        )

    validation_step_status = _resolve_validation_step_status(
        blockers=blockers,
        relationship_status=relationship_status,
    )

    if relationship_type == "raster_to_point_annotations":
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Validate point annotations against raster",
                status=validation_step_status,
                description=(
                    "Point annotations should be validated against the raster "
                    "after CRS and bounds are fixed."
                ),
                expected_result=(
                    "Point features fall inside the raster extent and can be used "
                    "as object centers, sample points, or training annotations."
                ),
                actions=[
                    "Check that all point features fall inside the raster extent.",
                    (
                        "Review whether points represent object centers, sample "
                        "locations, or detection labels."
                    ),
                    "Remove or flag points outside the raster coverage.",
                ],
            )
        )

    elif relationship_type == "raster_to_segmentation_labels":
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Validate polygon labels against raster",
                status=validation_step_status,
                description=(
                    "Polygon labels should be validated before mask generation "
                    "or segmentation preparation."
                ),
                expected_result=(
                    "Polygon labels overlap the raster and can be converted to "
                    "segmentation masks."
                ),
                actions=[
                    "Check polygon overlap with raster extent.",
                    "Repair invalid polygons if needed.",
                    "Prepare polygons for mask generation after alignment checks.",
                ],
            )
        )

    elif relationship_type == "raster_to_linear_features":
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Validate line features against raster",
                status=validation_step_status,
                description=(
                    "Line features should be validated against raster coverage "
                    "before extraction workflows."
                ),
                expected_result=(
                    "Line features overlap raster coverage and are suitable for "
                    "linear feature extraction."
                ),
                actions=[
                    "Check line features against raster extent.",
                    (
                        "Review whether line geometry represents roads, rivers, "
                        "networks, or other linear targets."
                    ),
                    "Prepare line features for extraction after alignment checks.",
                ],
            )
        )

    if relationship_status == "candidate_geoai_dataset":
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Confirm raster-vector relationship",
                status="passed",
                description=(
                    "Raster-vector relationship is trusted for the current "
                    "inspection stage."
                ),
                expected_result=(
                    "Raster and vector files can move forward to task-specific "
                    "preparation checks."
                ),
                actions=raster_vector_relationship_summary.get(
                    "recommended_actions",
                    [],
                ),
            )
        )

    if recommended_task:
        steps.append(
            _create_step(
                order=len(steps) + 1,
                title="Prepare GeoAI task inputs",
                status=_resolve_task_step_status(task_status),
                description=(
                    "Prepare model input data for the recommended task: "
                    f"{recommended_task.replace('_', ' ')}."
                ),
                expected_result=(
                    "Dataset is organized into task-specific model preparation inputs."
                ),
                actions=task_recommendation_summary.get("recommended_actions", []),
            )
        )

    steps.append(
        _create_step(
            order=len(steps) + 1,
            title="Export model-ready package",
            status=_resolve_export_step_status(blockers),
            description=(
                "Export the prepared dataset after CRS, bounds, relationship, "
                "and task checks are complete."
            ),
            expected_result=(
                "A clean model-ready package containing prepared spatial data, "
                "metadata, and task guidance."
            ),
            actions=[
                "Export corrected raster/vector files.",
                "Include metadata and CRS information.",
                "Include preparation report and warnings.",
                "Prepare the package for the selected GeoAI workflow.",
            ],
        )
    )

    return steps


def _create_step(
    order: int,
    title: str,
    status: str,
    description: str,
    expected_result: str,
    actions: list[str],
) -> dict:
    """
    Create one preparation plan step.
    """

    return {
        "order": order,
        "title": title,
        "status": status,
        "description": description,
        "expected_result": expected_result,
        "actions": _deduplicate_text_items(actions),
    }


def _resolve_plan_status(
    dataset_status: str,
    blockers: list[str],
    steps: list[dict],
) -> str:
    """
    Resolve preparation plan status.
    """

    if not steps:
        return "plan_not_available"

    if "crs_resolution_required" in blockers:
        return "blocked_by_crs"

    if blockers:
        return "blocked"

    if dataset_status in {"ready_for_alignment_check", "partially_ready"}:
        return "plan_ready"

    return "plan_needs_review"


def _resolve_validation_step_status(
    blockers: list[str],
    relationship_status: str,
) -> str:
    """
    Resolve status for geometry/label validation steps.
    """

    if blockers:
        return "blocked"

    if relationship_status == "candidate_geoai_dataset":
        return "ready"

    return "planned"


def _resolve_task_step_status(task_status: str) -> str:
    """
    Resolve preparation-plan step status from task status.
    """

    if task_status == "task_candidate":
        return "ready"

    if task_status in {
        "blocked_by_crs_review",
        "blocked_by_bounds_review",
        "blocked_by_relationship_review",
    }:
        return "blocked"

    return "planned"


def _resolve_export_step_status(blockers: list[str]) -> str:
    """
    Resolve export step status.
    """

    if blockers:
        return "planned"

    return "ready"


def _build_plan_summary(
    status: str,
    blockers: list[str],
    step_count: int,
) -> str:
    """
    Build preparation plan summary.
    """

    if status == "blocked_by_crs":
        return (
            f"GeoPrep AI generated a {step_count}-step preparation plan, "
            "but execution is currently blocked by CRS resolution."
        )

    if status == "blocked":
        blocker_label = ", ".join(blocker.replace("_", " ") for blocker in blockers)

        return (
            f"GeoPrep AI generated a {step_count}-step preparation plan, "
            f"but execution is blocked by: {blocker_label}."
        )

    if status == "plan_ready":
        return (
            f"Corrected re-upload validation passed. GeoPrep AI generated a "
            f"{step_count}-step preparation plan. The dataset can continue to "
            "task-specific preparation and export checks."
        )

    return (
        f"GeoPrep AI generated a {step_count}-step preparation plan, "
        "but some items still need review."
    )


def _build_plan_recommended_actions(
    status: str,
    blockers: list[str],
    steps: list[dict],
) -> list[str]:
    """
    Build high-level recommended actions for the preparation plan.
    """

    actions: list[str] = []

    if status == "plan_ready":
        actions.append(
            "Corrected re-upload validation passed for CRS, bounds, and raster-vector relationship checks."
        )
        actions.append(
            "Continue with the ready preparation steps before exporting the model-ready package."
        )

    if status == "blocked_by_crs":
        actions.append("Start with CRS resolution before running other preparation steps.")

    if "bounds_review_required" in blockers:
        actions.append("After CRS resolution, re-run bounds and overlap review.")

    if "raster_vector_relationship_review_required" in blockers:
        actions.append("After bounds review, validate the raster-vector relationship.")

    if "task_preparation_blocked" in blockers:
        actions.append(
            "Prepare GeoAI task inputs only after CRS, bounds, and relationship checks are complete."
        )

    if steps:
        first_step = _find_first_actionable_step(steps)
        actions.append(f"Begin with Step {first_step['order']}: {first_step['title']}.")

    if not actions:
        actions.append("Follow the preparation steps in order.")

    return _deduplicate_text_items(actions)


def _find_first_actionable_step(steps: list[dict]) -> dict:
    """
    Find first step that still needs action.
    """

    for step in steps:
        if step.get("status") in {"required", "blocked", "ready", "planned"}:
            return step

    return steps[0]


def _deduplicate_text_items(items: list[str]) -> list[str]:
    """
    Remove duplicate text items while preserving order.
    """

    deduplicated = []

    for item in items:
        if item not in deduplicated:
            deduplicated.append(item)

    return deduplicated
    