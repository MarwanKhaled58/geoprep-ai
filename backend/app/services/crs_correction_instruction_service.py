def generate_crs_correction_instruction_summary(
    crs_summary: dict,
    crs_resolution_guidance_summary: dict,
) -> dict:
    """
    Generate practical CRS correction and reprojection instructions.

    V1 purpose:
    - Convert CRS guidance into tool-specific instructions.
    - Provide ArcGIS Pro, QGIS, and Python/GeoPandas steps.
    - Avoid performing reprojection automatically.
    """

    target_crs = crs_resolution_guidance_summary.get("recommended_target_crs")
    target_epsg = crs_resolution_guidance_summary.get("recommended_target_epsg")
    file_guidance = crs_resolution_guidance_summary.get("file_guidance", [])
    crs_status = crs_summary.get("status")

    if crs_status == "consistent_crs":
        return {
            "status": "not_required",
            "summary": (
                "CRS correction is not required because all spatial files appear "
                "to use one consistent CRS."
            ),
            "target_crs": target_crs,
            "target_epsg": target_epsg,
            "files_to_reproject": [],
            "files_to_confirm": [],
            "arcgis_pro_steps": [],
            "qgis_steps": [],
            "python_steps": [],
            "recommended_actions": [
                "Continue to bounds, overlap, and spatial alignment checks."
            ],
        }

    if not target_crs or not target_epsg:
        return {
            "status": "manual_review_required",
            "summary": (
                "GeoPrep AI could not infer a reliable target CRS. CRS correction "
                "requires manual project CRS confirmation."
            ),
            "target_crs": None,
            "target_epsg": None,
            "files_to_reproject": [],
            "files_to_confirm": _collect_filenames(file_guidance),
            "arcgis_pro_steps": _build_manual_arcgis_steps(),
            "qgis_steps": _build_manual_qgis_steps(),
            "python_steps": _build_manual_python_steps(),
            "recommended_actions": [
                "Confirm the official project CRS before reprojection.",
                (
                    "Define missing or unclear CRS metadata before running bounds "
                    "or GeoAI preparation checks."
                ),
            ],
        }

    files_to_reproject = _detect_files_to_reproject(
        file_guidance=file_guidance,
        target_crs=target_crs,
        target_epsg=target_epsg,
    )

    files_to_confirm = _detect_files_to_confirm(
        file_guidance=file_guidance,
        target_crs=target_crs,
        target_epsg=target_epsg,
    )

    status = "correction_required" if files_to_reproject else "confirmation_required"

    return {
        "status": status,
        "summary": _build_instruction_summary(
            status=status,
            target_crs=target_crs,
            files_to_reproject=files_to_reproject,
            files_to_confirm=files_to_confirm,
        ),
        "target_crs": target_crs,
        "target_epsg": target_epsg,
        "files_to_reproject": files_to_reproject,
        "files_to_confirm": files_to_confirm,
        "arcgis_pro_steps": _build_arcgis_pro_steps(
            target_crs=target_crs,
            files_to_reproject=files_to_reproject,
            files_to_confirm=files_to_confirm,
        ),
        "qgis_steps": _build_qgis_steps(
            target_crs=target_crs,
            files_to_reproject=files_to_reproject,
            files_to_confirm=files_to_confirm,
        ),
        "python_steps": _build_python_steps(
            target_crs=target_crs,
            target_epsg=target_epsg,
            files_to_reproject=files_to_reproject,
            files_to_confirm=files_to_confirm,
        ),
        "recommended_actions": _build_recommended_actions(
            target_crs=target_crs,
            files_to_reproject=files_to_reproject,
            files_to_confirm=files_to_confirm,
        ),
    }


def _detect_files_to_reproject(
    file_guidance: list[dict],
    target_crs: str,
    target_epsg: int,
) -> list[dict]:
    """
    Detect files that should be reprojected to the target CRS.
    """

    files_to_reproject = []

    for item in file_guidance:
        filename = item.get("filename")
        detected_crs = item.get("detected_crs")
        epsg = item.get("epsg")
        status = item.get("status")

        if not filename:
            continue

        if status == "missing_crs":
            continue

        if isinstance(epsg, int) and epsg != target_epsg:
            files_to_reproject.append(
                {
                    "filename": filename,
                    "source_crs": f"EPSG:{epsg}",
                    "target_crs": target_crs,
                    "reason": "File CRS differs from the recommended target CRS.",
                }
            )
            continue

        inferred_epsg = _infer_epsg_from_text(detected_crs)

        if inferred_epsg and inferred_epsg != target_epsg:
            files_to_reproject.append(
                {
                    "filename": filename,
                    "source_crs": f"EPSG:{inferred_epsg}",
                    "target_crs": target_crs,
                    "reason": (
                        "File CRS appears different from the recommended target CRS."
                    ),
                }
            )
            continue

        if (
            detected_crs
            and detected_crs.startswith("EPSG:")
            and detected_crs != target_crs
        ):
            files_to_reproject.append(
                {
                    "filename": filename,
                    "source_crs": detected_crs,
                    "target_crs": target_crs,
                    "reason": "File CRS differs from the recommended target CRS.",
                }
            )

    return files_to_reproject


def _detect_files_to_confirm(
    file_guidance: list[dict],
    target_crs: str,
    target_epsg: int,
) -> list[dict]:
    """
    Detect files that need CRS confirmation instead of direct reprojection.
    """

    files_to_confirm = []

    for item in file_guidance:
        filename = item.get("filename")
        detected_crs = item.get("detected_crs")
        epsg = item.get("epsg")
        status = item.get("status")

        if not filename:
            continue

        if status == "missing_crs":
            files_to_confirm.append(
                {
                    "filename": filename,
                    "detected_crs": None,
                    "recommended_crs": target_crs,
                    "reason": (
                        "CRS metadata is missing and must be defined before "
                        "reprojection."
                    ),
                }
            )
            continue

        if isinstance(epsg, int) and epsg == target_epsg:
            files_to_confirm.append(
                {
                    "filename": filename,
                    "detected_crs": target_crs,
                    "recommended_crs": target_crs,
                    "reason": "File already matches the recommended target CRS.",
                }
            )
            continue

        inferred_epsg = _infer_epsg_from_text(detected_crs)

        if inferred_epsg == target_epsg:
            files_to_confirm.append(
                {
                    "filename": filename,
                    "detected_crs": target_crs,
                    "recommended_crs": target_crs,
                    "reason": (
                        "CRS was inferred from text and should be confirmed manually."
                    ),
                }
            )
            continue

        if status in {"unresolved_epsg", "unknown_crs"}:
            files_to_confirm.append(
                {
                    "filename": filename,
                    "detected_crs": _shorten_text(detected_crs),
                    "recommended_crs": target_crs,
                    "reason": (
                        "CRS could not be fully resolved and should be reviewed "
                        "manually."
                    ),
                }
            )

    return files_to_confirm


def _build_instruction_summary(
    status: str,
    target_crs: str,
    files_to_reproject: list[dict],
    files_to_confirm: list[dict],
) -> str:
    """
    Build human-readable CRS correction instruction summary.
    """

    if status == "correction_required":
        return (
            f"GeoPrep AI recommends using {target_crs} as the target CRS. "
            f"{len(files_to_reproject)} file(s) should be reprojected and "
            f"{len(files_to_confirm)} file(s) should be confirmed."
        )

    return (
        f"GeoPrep AI recommends using {target_crs} as the target CRS. "
        "No direct reprojection was detected, but CRS confirmation is still required."
    )


def _build_arcgis_pro_steps(
    target_crs: str,
    files_to_reproject: list[dict],
    files_to_confirm: list[dict],
) -> list[str]:
    """
    Build ArcGIS Pro CRS correction steps.
    """

    steps = [
        f"Set the project/map coordinate system to {target_crs}.",
        "Add the raster and vector files to ArcGIS Pro.",
        "Check each layer's current coordinate system from Layer Properties > Source.",
    ]

    for item in files_to_confirm:
        steps.append(
            f"Confirm {item['filename']} uses {item['recommended_crs']}. "
            f"Reason: {item['reason']}"
        )

    for item in files_to_reproject:
        steps.append(
            f"Run Project tool for {item['filename']} from "
            f"{item['source_crs']} to {item['target_crs']}."
        )

    steps.extend(
        [
            (
                "Save the corrected output as a new feature class or GeoJSON, "
                "not over the original file."
            ),
            "Re-upload the corrected files to GeoPrep AI and re-run dataset checks.",
        ]
    )

    return steps


def _build_qgis_steps(
    target_crs: str,
    files_to_reproject: list[dict],
    files_to_confirm: list[dict],
) -> list[str]:
    """
    Build QGIS CRS correction steps.
    """

    steps = [
        f"Set the QGIS project CRS to {target_crs}.",
        "Add the raster and vector files to QGIS.",
        "Check each layer CRS from Layer Properties > Information.",
    ]

    for item in files_to_confirm:
        steps.append(
            f"Confirm {item['filename']} uses {item['recommended_crs']}. "
            f"Reason: {item['reason']}"
        )

    for item in files_to_reproject:
        steps.append(
            f"Right-click {item['filename']} > Export > Save Features As, "
            f"then set CRS to {item['target_crs']}."
        )

    steps.extend(
        [
            "Save the corrected output as a new file, not over the original file.",
            "Re-upload the corrected files to GeoPrep AI and re-run dataset checks.",
        ]
    )

    return steps


def _build_python_steps(
    target_crs: str,
    target_epsg: int,
    files_to_reproject: list[dict],
    files_to_confirm: list[dict],
) -> list[str]:
    """
    Build Python/GeoPandas CRS correction steps.
    """

    steps = [
        "Use GeoPandas for vector reprojection.",
        f"Target CRS: {target_crs}.",
    ]

    for item in files_to_confirm:
        steps.append(
            f"Confirm {item['filename']} CRS before processing. "
            f"Reason: {item['reason']}"
        )

    for item in files_to_reproject:
        output_name = _build_reprojected_filename(item["filename"], target_epsg)

        code_example = (
            f"gdf = gpd.read_file('{item['filename']}'); "
            f"gdf = gdf.to_crs(epsg={target_epsg}); "
            f"gdf.to_file('{output_name}', driver='GeoJSON')"
        )

        steps.append(
            f"GeoPandas example for {item['filename']}: {code_example}"
        )

    steps.append("Re-upload the corrected files to GeoPrep AI and re-run dataset checks.")

    return steps


def _build_manual_arcgis_steps() -> list[str]:
    return [
        "Open ArcGIS Pro and inspect Layer Properties > Source for each spatial layer.",
        "Confirm the official project CRS with the project/client requirements.",
        "Use Define Projection only if the file has missing or incorrect CRS metadata.",
        "Use Project to create a new reprojected output after the source CRS is confirmed.",
    ]


def _build_manual_qgis_steps() -> list[str]:
    return [
        "Open QGIS and inspect Layer Properties > Information for each layer CRS.",
        "Confirm the official project CRS with the project/client requirements.",
        "Set Layer CRS only if the CRS metadata is missing or incorrectly assigned.",
        "Use Export > Save Features As to create a new output in the confirmed target CRS.",
    ]


def _build_manual_python_steps() -> list[str]:
    return [
        "Use GeoPandas only after the source CRS and target CRS are confirmed.",
        "If CRS metadata is missing, use set_crs only to define the known correct source CRS.",
        "Use to_crs only after the source CRS is correctly defined.",
    ]


def _build_recommended_actions(
    target_crs: str,
    files_to_reproject: list[dict],
    files_to_confirm: list[dict],
) -> list[str]:
    """
    Build high-level CRS correction actions.
    """

    actions = [
        f"Use {target_crs} as the working CRS unless project requirements specify another CRS.",
    ]

    for item in files_to_confirm:
        actions.append(f"Confirm CRS for {item['filename']} before continuing.")

    for item in files_to_reproject:
        actions.append(
            f"Create a reprojected copy of {item['filename']} in {target_crs}."
        )

    actions.append("Re-upload corrected files and re-run GeoPrep AI checks.")

    return _deduplicate_text_items(actions)


def _collect_filenames(file_guidance: list[dict]) -> list[dict]:
    """
    Collect filenames for manual review.
    """

    return [
        {
            "filename": item.get("filename") or "unknown file",
            "detected_crs": _shorten_text(item.get("detected_crs")),
            "recommended_crs": None,
            "reason": "Manual CRS review is required.",
        }
        for item in file_guidance
    ]


def _infer_epsg_from_text(text: object) -> int | None:
    """
    Infer EPSG from CRS text.
    """

    if not isinstance(text, str):
        return None

    normalized = text.lower()

    if "epsg:32618" in normalized:
        return 32618

    if "wgs 84" in normalized and "utm zone 18n" in normalized:
        return 32618

    if "epsg:4326" in normalized:
        return 4326

    return None


def _build_reprojected_filename(filename: str, target_epsg: int) -> str:
    """
    Build output filename for reprojected vector files.
    """

    if "." not in filename:
        return f"{filename}_epsg{target_epsg}.geojson"

    stem = filename.rsplit(".", 1)[0]

    return f"{stem}_epsg{target_epsg}.geojson"


def _shorten_text(text: object) -> str | None:
    """
    Shorten CRS text for UI display.
    """

    if not isinstance(text, str):
        return None

    if len(text) <= 120:
        return text

    return f"{text[:120]}..."


def _deduplicate_text_items(items: list[str]) -> list[str]:
    """
    Remove duplicate text items while preserving order.
    """

    deduplicated = []

    for item in items:
        if item not in deduplicated:
            deduplicated.append(item)

    return deduplicated
    