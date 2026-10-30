import os
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API and Mock Municipal Portal endpoints
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
