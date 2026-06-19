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


def inspect_gis_file(file_path: str, file_category: str) -> dict:
    """
    Inspect a GIS file and return normalized metadata.
    """

    if file_category == "raster":
        return inspect_raster(file_path)

    if file_category == "vector":
        return inspect_vector(file_path)

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


def inspect_vector(file_path: str) -> dict:
    """
    Inspect vector metadata using GeoPandas.
    """

    gdf = gpd.read_file(file_path)

    return {
        "is_gis_file": True,
        "gis_type": "vector",
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
    