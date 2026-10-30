import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    PROJECT_NAME: str = "JanSetu Lite - Civic Pulse Engine"
    VERSION: str = "0.2.0"
    API_PREFIX: str = "/api/v1"
    
    # AI Engine Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # Scheme Provider Configuration
    # Options: "apisetu" (Preferred live API) or "local" (Resilient hand-verified fallback)
    SCHEME_PROVIDER_TYPE: str = os.getenv("SCHEME_PROVIDER_TYPE", "local").lower()
    APISETU_BASE_URL: str = os.getenv("APISETU_BASE_URL", "https://apisetu.gov.in/v1/myscheme")
    APISETU_CLIENT_ID: str = os.getenv("APISETU_CLIENT_ID", "")
    APISETU_API_KEY: str = os.getenv("APISETU_API_KEY", "")
    APISETU_TIMEOUT_SECONDS: float = float(os.getenv("APISETU_TIMEOUT_SECONDS", "4.0"))

    # Mock Municipal Portal Configuration
    PORTAL_URL: str = os.getenv("PORTAL_URL", "http://localhost:8000/portal")
    HEADLESS_BROWSER: bool = os.getenv("HEADLESS_BROWSER", "true").lower() == "true"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173", "*"]

settings = Settings()
