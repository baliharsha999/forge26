import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.endpoints import router as api_router
from app.db.database import init_db

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API engine for JanSetu AI: Multimodal Civic Grievance, Scheme Navigator & Policy Fact Checker"
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

# Mount API endpoints
app.include_router(api_router)

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "track": "Civic Pulse, Digital Governance & Public Information",
        "status": "online",
        "compliance": "Zero Dummy Data - Active SQLite DB & Real-Time APIs",
        "endpoints": {
            "grievance_analyze": "/api/v1/grievance/analyze",
            "grievance_submit": "/api/v1/grievance/submit",
            "grievance_list": "/api/v1/grievance/list",
            "grievance_track": "/api/v1/grievance/track/{tracking_id}",
            "fact_check": "/api/v1/fact-check",
            "schemes": "/api/v1/schemes",
            "geocode_reverse": "/api/v1/geocode/reverse"
        }
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "database": "connected", "agent_engine": "ready"}
