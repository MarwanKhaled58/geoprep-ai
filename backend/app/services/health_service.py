from app.core.config import APP_NAME, APP_VERSION


def get_health_status() -> dict:
    """
    Return the current health status of the backend API.
    """

    return {
        "status": "success",
        "message": "GeoPrep AI backend is running",
        "app_name": APP_NAME,
        "version": APP_VERSION,
    }