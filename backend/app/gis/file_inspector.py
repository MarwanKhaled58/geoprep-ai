from pathlib import Path

import geopandas as gpd
import rasterio


def normalize_crs(crs) -> dict:
    """
    Normalize CRS information into a clean response format.

    Parameters
    ----------
    crs : Any
        CRS object from Rasterio or GeoPandas.

    Returns
    -------
    dict
        Clean CRS metadata.
    """

    if crs is None:
        return {
            "has_crs": False,
            "crs_text": None,
            "epsg": None,
            "authority": None,
        }

    epsg = crs.to_epsg() if hasattr(crs, "to_epsg") else None

    return {
        "has_crs": True,
        "crs_text": f"EPSG:{epsg}" if epsg else str(crs),
        "epsg": epsg,
        "authority": f"EPSG:{epsg}" if epsg else None,
    }


def inspect_gis_file(
    file_path: str,
    file_category: str,
    display_filename: str | None = None,
) -> dict:
    """
    Inspect a GIS file and return normalized metadata.
    """

    if file_category == "raster":
        return inspect_raster(file_path)

    if file_category == "vector":
        return inspect_vector(file_path, display_filename=display_filename)

    return {
        "is_gis_file": False,
        "gis_type": None,
        "crs": None,
        "metadata": None,
    }


def inspect_raster(file_path: str) -> dict:
    """
    Inspect raster metadata using Rasterio.
    """

    with rasterio.open(file_path) as src:
        return {
            "is_gis_file": True,
            "gis_type": "raster",
            "crs": normalize_crs(src.crs),
            "metadata": {
                "width": src.width,
                "height": src.height,
                "band_count": src.count,
                "bounds": {
                    "left": src.bounds.left,
                    "bottom": src.bounds.bottom,
                    "right": src.bounds.right,
                    "top": src.bounds.top,
                },
                "resolution": {
                    "x": src.res[0],
                    "y": src.res[1],
                },
                "driver": src.driver,
                "dtype": list(src.dtypes),
                "nodata": src.nodata,
            },
        }


def inspect_vector(file_path: str, display_filename: str | None = None) -> dict:
    """
    Inspect vector metadata using GeoPandas.
    """

    shapefile_issue = _validate_shapefile_sidecars(
        file_path=file_path,
        display_filename=display_filename,
    )

    if shapefile_issue:
        return _build_failed_vector_inspection(
            error_code="INCOMPLETE_SHAPEFILE",
            message=shapefile_issue,
        )

    try:
        gdf = gpd.read_file(file_path)
    except Exception as exc:
        return _build_failed_vector_inspection(
            error_code="VECTOR_INSPECTION_FAILED",
            message=str(exc),
        )

    return {
        "is_gis_file": True,
        "gis_type": "vector",
        "inspection_status": "complete",
        "crs": normalize_crs(gdf.crs),
        "metadata": {
            "feature_count": len(gdf),
            "geometry_types": list(gdf.geometry.geom_type.unique()),
            "empty_geometry_count": int(gdf.geometry.is_empty.sum()),
            "invalid_geometry_count": int((~gdf.geometry.is_valid).sum()),
            "bounds": {
                "minx": float(gdf.total_bounds[0]),
                "miny": float(gdf.total_bounds[1]),
                "maxx": float(gdf.total_bounds[2]),
                "maxy": float(gdf.total_bounds[3]),
            },
            "columns": list(gdf.columns),
        },
    }


def _validate_shapefile_sidecars(
    file_path: str,
    display_filename: str | None = None,
) -> str | None:
    """
    Validate required shapefile sidecars before opening with GeoPandas.
    """

    path = Path(file_path)

    if path.suffix.lower() != ".shp":
        return None

    missing_extensions = [
        extension
        for extension in [".shx", ".dbf"]
        if not path.with_suffix(extension).exists()
    ]

    if not missing_extensions:
        return None

    missing_list = ", ".join(missing_extensions)

    filename = display_filename or path.name

    return (
        f"Incomplete shapefile upload. {filename} is missing required "
        f"shapefile sidecar file(s): {missing_list}."
    )


def _build_failed_vector_inspection(error_code: str, message: str) -> dict:
    """
    Return a structured vector inspection failure without raising a 500.
    """

    return {
        "is_gis_file": True,
        "gis_type": "vector",
        "inspection_status": "failed",
        "inspection_error_code": error_code,
        "inspection_error": message,
        "crs": {
            "has_crs": False,
            "crs_text": None,
            "epsg": None,
            "authority": None,
        },
        "metadata": {
            "inspection_error_code": error_code,
            "inspection_error": message,
        },
    }
