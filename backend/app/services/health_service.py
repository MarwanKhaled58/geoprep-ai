from app.core.config import APP_VERSION


def get_health_status() -> dict:
    """
    Return the current health status of the backend API.
    """

    return {
        "status": "ok",
        "service": "GeoPrep AI Backend",
        "version": APP_VERSION,
    }
