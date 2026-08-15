from fastapi import APIRouter

from app.schemas.health_schema import HealthResponse
from app.services.health_service import get_health_status

router = APIRouter(
    tags=["Health"],
)


@router.get("/api/health", response_model=HealthResponse)
@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """
    Health check endpoint used to verify that the API is running.
    """

    return get_health_status()
