"""
File readiness analysis service.

This service converts classification, GIS inspection, and warning results
into a simple readiness report.

Current scope:
- File-level readiness analysis

Future scope:
- Dataset-level readiness analysis
- Dataset readiness scoring
- Task/model recommendation bridge
"""


def generate_file_readiness_report(
    file_classification: dict,
    gis_inspection: dict | None,
    warnings: list[dict],
) -> dict:
    """
    Generate a readiness report for a single uploaded file.

    This is intentionally designed to look similar to the future
    dataset readiness report, but it currently works at file level only.
    """

    file_category = file_classification.get("file_category")
    is_supported = file_classification.get("is_supported", False)

    if not is_supported:
        return {
            "readiness_score": 0,
            "status": "not_ready",
            "summary": "This file is not supported by the current GeoPrep AI workflow.",
            "issues": _extract_issue_messages(warnings),
            "recommended_actions": _extract_recommended_actions(warnings)
            or ["Upload a supported file type."],
            "inspection_level": "classification",
            "can_continue_to_dataset": False,
        }

    if not gis_inspection:
        return {
            "readiness_score": 20,
            "status": "inspection_failed",
            "summary": "The file is supported, but GeoPrep AI could not inspect it.",
            "issues": _extract_issue_messages(warnings)
            or ["GIS inspection was not completed."],
            "recommended_actions": _extract_recommended_actions(warnings)
            or ["Check that the file is valid and readable, then upload it again."],
            "inspection_level": "classification",
            "can_continue_to_dataset": False,
        }

    if not gis_inspection.get("is_gis_file"):
        return {
            "readiness_score": 40,
            "status": "supporting_file",
            "summary": "This file is supported, but it is not a spatial GIS file. It can be kept as supporting dataset material.",
            "issues": _extract_issue_messages(warnings),
            "recommended_actions": _extract_recommended_actions(warnings)
            or ["Upload raster or vector GIS data for spatial readiness analysis."],
            "inspection_level": "classification",
            "can_continue_to_dataset": True,
        }

    gis_type = gis_inspection.get("gis_type")
    crs = gis_inspection.get("crs") or {}

    score = 100
    status = "ready"
    issues = _extract_issue_messages(warnings)
    recommended_actions = _extract_recommended_actions(warnings)

    for warning in warnings:
        severity = warning.get("severity")

        if severity == "error":
            score -= 40
        elif severity == "warning":
            score -= 20
        elif severity == "info":
            score -= 5

    if not crs.get("has_crs"):
        score = min(score, 60)

    score = max(score, 0)

    if score >= 85:
        status = "ready"
    elif score >= 60:
        status = "partially_ready"
    else:
        status = "not_ready"

    if not issues:
        issues = []

    if not recommended_actions:
        recommended_actions = [
            "No immediate action required at the current inspection stage."
        ]

    return {
        "readiness_score": score,
        "status": status,
        "summary": f"This {gis_type} file has been inspected and assigned a readiness status of '{status}'.",
        "issues": issues,
        "recommended_actions": recommended_actions,
        "inspection_level": "gis_metadata",
        "can_continue_to_dataset": score >= 60,
    }


def _extract_issue_messages(warnings: list[dict]) -> list[str]:
    """
    Extract issue messages from warnings.
    """

    return [
        warning.get("message")
        for warning in warnings
        if warning.get("message")
    ]


def _extract_recommended_actions(warnings: list[dict]) -> list[str]:
    """
    Extract recommended actions from warnings.
    """

    actions = []

    for warning in warnings:
        action = warning.get("recommended_action")
        if action and action not in actions:
            actions.append(action)

    return actions
    