"""
Application configuration settings.
"""


from pathlib import Path

APP_NAME = "GeoPrep AI API"
APP_VERSION = "0.1.0"
MAX_UPLOAD_SIZE_MB = 100
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]