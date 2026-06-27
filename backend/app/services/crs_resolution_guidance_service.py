def generate_crs_resolution_guidance_summary(
    files: list[dict],
    crs_summary: dict,
) -> dict:
    """
    Generate CRS resolution guidance for mixed, missing, or unresolved CRS cases.

    V1 purpose:
    - Explain why CRS review is needed.
    - Suggest a likely target CRS when possible.
    - Recommend which files need reprojection or manual CRS review.
    """

    crs_status = crs_summary.get("status", "unknown")
    spatial_files = [
        file
        for file in files
        if file.get("file_category") in {"raster", "vector"}
        or file.get("gis_type") in {"raster", "vector"}
    ]

    if not spatial_files:
        return {
            "status": "not_applicable",
            "summary": "No spatial files are available for CRS resolution guidance.",
            "recommended_target_crs": None,
            "recommended_target_epsg": None,
            "file_guidance": [],
            "issues": [],
            "recommended_actions": [
                "Upload raster or vector GIS files before CRS resolution guidance."
            ],
        }

    file_guidance = _build_file_guidance(spatial_files)
    target_crs = _infer_recommended_target_crs(spatial_files)

    issues = _build_crs_resolution_issues(
        crs_status=crs_status,
        crs_summary=crs_summary,
    )

    recommended_actions = _build_crs_resolution_actions(
        crs_status=crs_status,
        target_crs=target_crs,
        file_guidance=file_guidance,
    )

    status = _resolve_guidance_status(crs_status)

    return {
        "status": status,
        "summary": _build_guidance_summary(
            status=status,
            crs_status=crs_status,
            target_crs=target_crs,
        ),
        "recommended_target_crs": target_crs.get("label") if target_crs else None,
        "recommended_target_epsg": target_crs.get("epsg") if target_crs else None,
        "file_guidance": file_guidance,
        "issues": _deduplicate_text_items(issues),
        "recommended_actions": _deduplicate_text_items(recommended_actions),
    }


def _build_file_guidance(spatial_files: list[dict]) -> list[dict]:
    """
    Build per-file CRS guidance.
    """

    guidance = []

    for file in spatial_files:
        filename = file.get("original_filename") or "unknown file"
        file_category = file.get("file_category") or file.get("gis_type") or "unknown"
        has_crs = file.get("has_crs")
        epsg = file.get("epsg")
        crs_text = file.get("crs_text")

        if not has_crs:
            status = "missing_crs"
            detected_crs = None
            recommended_action = (
                "Define the correct CRS for this file before reprojection or alignment."
            )
        elif isinstance(epsg, int):
            status = "resolved_crs"
            detected_crs = f"EPSG:{epsg}"
            recommended_action = (
                "Keep this CRS if it matches the target CRS, otherwise reproject it."
            )
        elif isinstance(crs_text, str) and crs_text:
            status = "unresolved_epsg"
            detected_crs = _shorten_crs_text(crs_text)
            recommended_action = (
                "Review this CRS manually and map it to an EPSG code if possible."
            )
        else:
            status = "unknown_crs"
            detected_crs = None
            recommended_action = (
                "Inspect this file manually because CRS metadata is incomplete."
            )

        guidance.append(
            {
                "filename": filename,
                "file_category": file_category,
                "status": status,
                "detected_crs": detected_crs,
                "epsg": epsg,
                "recommended_action": recommended_action,
            }
        )

    return guidance


def _infer_recommended_target_crs(spatial_files: list[dict]) -> dict | None:
    """
    Infer a likely target CRS.

    V1 rule:
    - Prefer raster CRS when raster exists, because raster reprojection can be more expensive
      and may affect pixel alignment.
    - If raster has unresolved text containing a known UTM zone, infer EPSG.
    - Otherwise prefer the most common resolved EPSG.
    """

    raster_files = [
        file
        for file in spatial_files
        if file.get("file_category") == "raster"
        or file.get("gis_type") == "raster"
    ]

    for raster_file in raster_files:
        epsg = raster_file.get("epsg")

        if isinstance(epsg, int):
            return {
                "label": f"EPSG:{epsg}",
                "epsg": epsg,
                "reason": "Raster CRS is preferred as the target CRS for V1 guidance.",
            }

        crs_text = raster_file.get("crs_text")

        inferred_epsg = _infer_epsg_from_crs_text(crs_text)

        if inferred_epsg:
            return {
                "label": f"EPSG:{inferred_epsg}",
                "epsg": inferred_epsg,
                "reason": "Target CRS was inferred from raster CRS text.",
            }

    epsg_counts: dict[int, int] = {}

    for file in spatial_files:
        epsg = file.get("epsg")

        if isinstance(epsg, int):
            epsg_counts[epsg] = epsg_counts.get(epsg, 0) + 1

    if not epsg_counts:
        return None

    most_common_epsg = max(epsg_counts, key=epsg_counts.get)

    return {
        "label": f"EPSG:{most_common_epsg}",
        "epsg": most_common_epsg,
        "reason": "Target CRS was selected from the most common resolved EPSG code.",
    }


def _infer_epsg_from_crs_text(crs_text: object) -> int | None:
    """
    Infer EPSG from common CRS text patterns.

    V1 intentionally supports a small safe list.
    """

    if not isinstance(crs_text, str):
        return None

    normalized = crs_text.lower()

    if "wgs 84" in normalized and "utm zone 18n" in normalized:
        return 32618

    if "wgs 84" in normalized and "utm zone 36n" in normalized:
        return 32636

    if "wgs 84" in normalized and "utm zone 37n" in normalized:
        return 32637

    return None


def _build_crs_resolution_issues(
    crs_status: str,
    crs_summary: dict,
) -> list[str]:
    """
    Build CRS resolution issues.
    """

    issues: list[str] = []

    if crs_status == "missing_crs":
        issues.append("Some spatial files are missing CRS metadata.")

    if crs_status == "mixed_crs":
        issues.append("Spatial files use different CRS definitions.")

    if crs_status == "unresolved_crs":
        issues.append("Some CRS definitions could not be resolved to EPSG codes.")

    if crs_summary.get("files_with_unresolved_crs"):
        issues.append("At least one file requires manual CRS confirmation.")

    return issues


def _build_crs_resolution_actions(
    crs_status: str,
    target_crs: dict | None,
    file_guidance: list[dict],
) -> list[str]:
    """
    Build recommended CRS resolution actions.
    """

    actions: list[str] = []

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        actions.append(
            "Resolve CRS issues before bounds comparison, alignment, or GeoAI preparation."
        )

    if target_crs:
        target_label = target_crs["label"]
        target_epsg = target_crs.get("epsg")

        actions.append(
            f"Use {target_label} as the recommended target CRS for this dataset unless project requirements specify another CRS."
        )

        for item in file_guidance:
            detected_crs = item.get("detected_crs")
            filename = item.get("filename")
            status = item.get("status")
            epsg = item.get("epsg")

            if status == "missing_crs":
                actions.append(
                    f"Define the correct CRS for {filename}, then reproject it to {target_label} if needed."
                )
                continue

            if isinstance(epsg, int):
                if epsg == target_epsg:
                    actions.append(f"Keep {filename} in {target_label}.")
                else:
                    actions.append(
                        f"Reproject {filename} from EPSG:{epsg} to {target_label}."
                    )
                continue

            inferred_epsg = _infer_epsg_from_crs_text(detected_crs)

            if inferred_epsg == target_epsg:
                actions.append(
                    f"Confirm {filename} as {target_label}, then keep it as the target CRS."
                )
                continue

            if detected_crs:
                actions.append(
                    f"Review the CRS for {filename} manually, then reproject it to {target_label} if needed."
                )
            else:
                actions.append(
                    f"Review the CRS for {filename} manually before deciding whether reprojection is needed."
                )
    else:
        actions.append(
            "No reliable target CRS could be inferred. Confirm the project CRS manually."
        )

    return actions
    """
    Build recommended CRS resolution actions.
    """

    actions: list[str] = []

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        actions.append("Resolve CRS issues before bounds comparison, alignment, or GeoAI preparation.")

    if target_crs:
        target_label = target_crs["label"]

        actions.append(
            f"Use {target_label} as the recommended target CRS for this dataset unless project requirements specify another CRS."
        )

        for item in file_guidance:
            detected_crs = item.get("detected_crs")
            filename = item.get("filename")
            status = item.get("status")

            if status == "missing_crs":
                actions.append(
                    f"Define the correct CRS for {filename}, then reproject it to {target_label} if needed."
                )
            elif detected_crs and detected_crs != target_label:
                actions.append(
                    f"Reproject {filename} from {detected_crs} to {target_label}."
                )
            elif detected_crs == target_label:
                actions.append(
                    f"Keep {filename} in {target_label}."
                )
    else:
        actions.append(
            "No reliable target CRS could be inferred. Confirm the project CRS manually."
        )

    return actions


def _resolve_guidance_status(crs_status: str) -> str:
    """
    Resolve CRS guidance status.
    """

    if crs_status == "consistent_crs":
        return "crs_ready"

    if crs_status in {"missing_crs", "mixed_crs", "unresolved_crs"}:
        return "crs_resolution_required"

    if crs_status == "no_spatial_files":
        return "not_applicable"

    return "crs_needs_review"


def _build_guidance_summary(
    status: str,
    crs_status: str,
    target_crs: dict | None,
) -> str:
    """
    Build CRS guidance summary.
    """

    if status == "crs_ready":
        return "CRS appears consistent across spatial files. No CRS resolution is required at this stage."

    if target_crs:
        return (
            f"CRS status is '{crs_status}'. GeoPrep AI recommends using "
            f"{target_crs['label']} as the target CRS. {target_crs['reason']}"
        )

    return (
        f"CRS status is '{crs_status}'. GeoPrep AI could not infer a safe target CRS automatically."
    )


def _shorten_crs_text(crs_text: str) -> str:
    """
    Shorten CRS text for UI display.
    """

    if len(crs_text) <= 120:
        return crs_text

    return f"{crs_text[:120]}..."


def _deduplicate_text_items(items: list[str]) -> list[str]:
    """
    Remove duplicate text items while preserving order.
    """

    deduplicated = []

    for item in items:
        if item not in deduplicated:
            deduplicated.append(item)

    return deduplicated  