from pydantic import BaseModel


class HealthResponse(BaseModel):
    """
    Response model for health check endpoints.
    """

    status: str
    service: str
    version: str
