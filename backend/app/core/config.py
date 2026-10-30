import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    PROJECT_NAME: str = "JanSetu AI - Civic Pulse Engine"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api/v1"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    PORTAL_URL: str = os.getenv("PORTAL_URL", "http://localhost:8080")
    HEADLESS_BROWSER: bool = os.getenv("HEADLESS_BROWSER", "true").lower() == "true"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173", "*"]

settings = Settings()
