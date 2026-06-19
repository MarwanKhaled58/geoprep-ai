"""
File warning generation service.

This service converts file classification and GIS inspection results into
user-facing data quality warnings. It belongs to Phase 2 — Data Quality.
"""


def _create_warning(
    code: str,
    severity: str,
    message: str,
    recommended_action: str | None = None,
    details: dict | None = None,
) -> dict:
    """
    Create a normalized warning dictionary.
    """

    return {
        "code": code,
        "severity": severity,
        "message": message,
        "recommended_action": recommended_action,
        "details": details or {},
    }


def generate_file_warnings(file_classification: dict, gis_inspection: dict | None) -> list[dict]:
    """
    Generate data quality warnings for an uploaded file.

    Parameters
    ----------
    file_classification : dict
        Result returned from file_classifier_service.classify_file.
    gis_inspection : dict | None
        Result returned from gis.file_inspector.inspect_gis_file.

    Returns
    -------
    list[dict]
        List of normalized warnings.
    """

    warnings: list[dict] = []

    file_category = file_classification.get("file_category")
    is_supported = file_classification.get("is_supported", False)
    reason = file_classification.get("reason")

    if not is_supported:
        warnings.append(
            _create_warning(
                code="UNSUPPORTED_FILE_TYPE",
                severity="error",
                message="This file type is not supported by the current GeoPrep AI inspection workflow.",
                recommended_action="Upload a supported raster, vector, tabular, image, config, or document file.",
                details={"reason": reason, "file_category": file_category},
            )
        )
        return warnings

    if not gis_inspection:
        warnings.append(
            _create_warning(
                code="INSPECTION_NOT_AVAILABLE",
                severity="warning",
                message="GeoPrep AI could not inspect this file for GIS metadata.",
                recommended_action="Check that the file is valid and readable, then upload it again.",
            )
        )
        return warnings

    if not gis_inspection.get("is_gis_file"):
        warnings.append(
            _create_warning(
                code="NOT_GIS_INSPECTABLE",
                severity="info",
                message="This file is supported, but it is not a GIS file that can be inspected for CRS or spatial metadata.",
                recommended_action="Use this file later as supporting dataset material, or upload raster/vector GIS data for spatial inspection.",
                details={"file_category": file_category},
            )
        )
        return warnings

    crs = gis_inspection.get("crs") or {}
    metadata = gis_inspection.get("metadata") or {}
    gis_type = gis_inspection.get("gis_type")

    if not crs.get("has_crs"):
        warnings.append(
            _create_warning(
                code="MISSING_CRS",
                severity="warning",
                message="This GIS file does not contain CRS metadata.",
                recommended_action="Define or assign the correct CRS before using this file in a GeoAI dataset.",
                details={"gis_type": gis_type},
            )
        )
    elif crs.get("epsg") is None:
        warnings.append(
            _create_warning(
                code="UNKNOWN_CRS_AUTHORITY",
                severity="info",
                message="The file has CRS metadata, but GeoPrep AI could not resolve it to an EPSG code.",
                recommended_action="Review the CRS manually and confirm it matches the rest of the dataset.",
                details={"crs_text": crs.get("crs_text")},
            )
        )

    if gis_type == "raster":
        _add_raster_warnings(warnings, metadata)

    if gis_type == "vector":
        _add_vector_warnings(warnings, metadata)

    return warnings


def _add_raster_warnings(warnings: list[dict], metadata: dict) -> None:
    """
    Add raster-specific warnings.
    """

    if metadata.get("nodata") is None:
        warnings.append(
            _create_warning(
                code="MISSING_NODATA_VALUE",
                severity="info",
                message="This raster does not define a nodata value.",
                recommended_action="Confirm whether background or missing pixels need a nodata value before model training.",
            )
        )

    if metadata.get("band_count") == 0:
        warnings.append(
            _create_warning(
                code="EMPTY_RASTER_BANDS",
                severity="error",
                message="This raster has no readable bands.",
                recommended_action="Check the raster source file or export it again.",
            )
        )


def _add_vector_warnings(warnings: list[dict], metadata: dict) -> None:
    """
    Add vector-specific warnings.
    """

    if metadata.get("feature_count") == 0:
        warnings.append(
            _create_warning(
                code="EMPTY_VECTOR_LAYER",
                severity="warning",
                message="This vector file contains no features.",
                recommended_action="Upload a vector layer that contains geometries before using it for labels or masks.",
            )
        )

    if metadata.get("empty_geometry_count", 0) > 0:
        warnings.append(
            _create_warning(
                code="EMPTY_GEOMETRIES_FOUND",
                severity="warning",
                message="This vector file contains empty geometries.",
                recommended_action="Remove or repair empty geometries before preparing labels or masks.",
                details={"empty_geometry_count": metadata.get("empty_geometry_count")},
            )
        )

    if metadata.get("invalid_geometry_count", 0) > 0:
        warnings.append(
            _create_warning(
                code="INVALID_GEOMETRIES_FOUND",
                severity="warning",
                message="This vector file contains invalid geometries.",
                recommended_action="Repair invalid geometries before generating masks, labels, or training data.",
                details={"invalid_geometry_count": metadata.get("invalid_geometry_count")},
            )
        )