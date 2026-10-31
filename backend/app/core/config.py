import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Search for .env in current directory, backend directory, and repo root
_env_paths = [
    Path.cwd() / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
]
for p in _env_paths:
    if p.exists():
        load_dotenv(dotenv_path=p, override=True)


class Settings(BaseModel):
    PROJECT_NAME: str = "Nagarik AI - Civic Engine"
    VERSION: str = "0.2.0"
    API_PREFIX: str = "/api/v1"
    
    # AI Engine Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    FALLBACK_MODEL: str = os.getenv("FALLBACK_MODEL", "openai/gpt-oss-120b")
    LOW_MEMORY_MODE: bool = os.getenv("LOW_MEMORY_MODE", "true").lower() == "true"
    VECTOR_DB_TYPE: str = os.getenv("VECTOR_DB_TYPE", "faiss")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

    # LangSmith Tracing & Observability
    LANGCHAIN_TRACING_V2: str = os.getenv("LANGCHAIN_TRACING_V2", "true")
    LANGCHAIN_API_KEY: str = os.getenv("LANGCHAIN_API_KEY", "")
    LANGCHAIN_PROJECT: str = os.getenv("LANGCHAIN_PROJECT", "government-scheme-assistant")
    
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

    # WhatsApp Integration Configuration
    WHATSAPP_VERIFY_TOKEN: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "nagarik_ai_secure_token")
    WHATSAPP_PHONE_NUMBER: str = os.getenv("WHATSAPP_PHONE_NUMBER", "+919876543210")
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")


settings = Settings()
