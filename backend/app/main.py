import os
import sys

# Ensure UTF-8 console output on Windows to prevent UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.endpoints import router as api_router
from app.api.portal_routes import portal_router
from app.db.database import init_db

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Nagarik AI: Empowering Every Citizen - Multimodal Civic Grievance & Redressal Copilot"
)

# Initialize live SQLite database
init_db()

# Enable CORS for frontend and external calls
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "https://nagarik-ai.web.app",
    "https://nagarik-ai.firebaseapp.com",
    "https://cyugandharreddy08.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^chrome-extension://[a-z]{32}$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount API and Municipal Portal endpoints
app.include_router(api_router)
app.include_router(portal_router)

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "track": "Civic Pulse, Digital Governance & Public Information",
        "status": "online",
        "scheme_provider": settings.SCHEME_PROVIDER_TYPE,
        "endpoints": {
            "grievance_analyze": "/api/v1/grievance/analyze",
            "grievance_submit": "/api/v1/grievance/submit",
            "grievance_list": "/api/v1/grievance/list",
            "escalate": "/api/v1/escalate",
            "fact_check": "/api/v1/fact-check",
            "schemes": "/api/v1/schemes",
            "schemes_eligibility": "/api/v1/schemes/eligibility",
            "mock_portal": "/portal",
            "mock_portal_admin": "/portal/admin"
        }
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "scheme_provider": settings.SCHEME_PROVIDER_TYPE,
        "agent_engine": "ready"
    }
