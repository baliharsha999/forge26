from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.schemas import (
    GrievanceAnalysisRequest, GrievanceAnalysisResult,
    GrievanceSubmissionRequest, GrievanceSubmissionResult,
    FactCheckRequest, FactCheckResult,
    GovernmentScheme
)
from app.services.gemini_service import analyze_civic_grievance
from app.services.live_data_service import search_schemes, verify_claim_against_fact_checks, reverse_geocode_osm
from app.agent.browser_agent import execute_browser_grievance_filing
from app.db.database import get_grievance_by_tracking_id, list_all_grievances

router = APIRouter(prefix="/api/v1")

@router.post("/grievance/analyze", response_model=GrievanceAnalysisResult)
async def api_analyze_grievance(req: GrievanceAnalysisRequest):
    """
    Multimodal AI Endpoint: Analyzes speech transcripts or text in any regional language,
    detects urgency, extracts landmarks, and prepares formal statutory petition.
    """
    try:
        result = await analyze_civic_grievance(
            raw_input=req.raw_input,
            language=req.language or "en",
            image_base64=req.image_base64,
            location=req.location
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@router.post("/grievance/submit", response_model=GrievanceSubmissionResult)
async def api_submit_grievance(req: GrievanceSubmissionRequest):
    """
    Autonomous Agent Endpoint: Dispatches browser agent to navigate public grievance
    portal, auto-fill verified data, capture live telemetry, and return official registration ID.
    """
    try:
        submission = await execute_browser_grievance_filing(req)
        return submission
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Submission error: {str(e)}")

@router.get("/grievance/list")
async def api_list_grievances(limit: int = 50):
    """
    Live Database Query: Retrieves all grievances currently logged in the civic system.
    """
    return list_all_grievances(limit=limit)

@router.get("/grievance/track/{tracking_id}")
async def api_track_grievance(tracking_id: str):
    """
    Real-time Tracking: Returns SLA status, assigned ward officer, and telemetry timeline.
    """
    record = get_grievance_by_tracking_id(tracking_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Tracking ID {tracking_id} not found")
    return record

@router.post("/fact-check", response_model=FactCheckResult)
async def api_fact_check_claim(req: FactCheckRequest):
    """
    Misinformation Shield: Cross-references viral claims against PIB and official gazettes.
    """
    try:
        return verify_claim_against_fact_checks(req.claim)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fact-checking error: {str(e)}")

@router.get("/schemes", response_model=List[GovernmentScheme])
async def api_get_schemes(
    category: str = Query("all", description="farmer, student, women, healthcare, senior, msme"),
    state: str = Query("All-India", description="State filter"),
    query: str = Query("", description="Keyword search")
):
    """
    Verified Scheme Navigator: Returns active Central and State schemes.
    """
    data = search_schemes(query=query, category=category, state=state)
    return [GovernmentScheme(**s) for s in data]

@router.get("/geocode/reverse")
async def api_reverse_geocode(lat: float, lon: float):
    """
    Live OpenStreetMap Geocoding: Converts GPS coordinates to district and municipal zone.
    """
    return await reverse_geocode_osm(lat, lon)
