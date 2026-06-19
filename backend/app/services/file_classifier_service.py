from pathlib import Path


SUPPORTED_EXTENSIONS = {
    "raster": [".tif", ".tiff"],
    "vector": [".geojson", ".json", ".shp", ".gpkg", ".kml"],
    "tabular": [".csv", ".xlsx", ".xls"],
    "image": [".jpg", ".jpeg", ".png"],
    "config": [".yaml", ".yml", ".toml"],
    "document": [".txt", ".md", ".pdf"],
}

DANGEROUS_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".ps1",
    ".dll",
    ".msi",
    ".scr",
}


def classify_file(filename: str) -> dict:
    """
    Classify an uploaded file based on its extension.

    Parameters
    ----------
    filename : str
        Original uploaded filename.

    Returns
    -------
    dict
        File category, extension, and support status.
    """

    extension = Path(filename).suffix.lower()

    if extension in DANGEROUS_EXTENSIONS:
        return {
            "file_extension": extension,
            "file_category": "dangerous",
            "is_supported": False,
            "reason": "Potentially unsafe executable or script file.",
        }

    for category, extensions in SUPPORTED_EXTENSIONS.items():
        if extension in extensions:
            return {
                "file_extension": extension,
                "file_category": category,
                "is_supported": True,
                "reason": "Supported file type.",
            }

    return {
        "file_extension": extension,
        "file_category": "unknown",
        "is_supported": False,
        "reason": "Unknown or unsupported file type.",
    }

    