from pydantic import BaseModel


class HealthResponse(BaseModel):
    """
    Response model for health check endpoints.
    """

    status: str
    message: str
    app_name: str
    version: str