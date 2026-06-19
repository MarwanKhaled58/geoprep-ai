from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.upload import router as upload_router

from app.api.routes.health import router as health_router
from app.core.config import ALLOWED_ORIGINS, APP_NAME, APP_VERSION

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(upload_router)


@app.get("/")
def root() -> dict:
    return {
        "message": "Welcome to GeoPrep AI API",
        "docs": "/docs",
        "health": "/api/health",
    }