from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from app.models.schemas import (
    GrievanceAnalysisRequest, GrievanceAnalysisResult,
    GrievanceSubmissionRequest, GrievanceSubmissionResult,
    FactCheckRequest, FactCheckResult,
    NormalizedScheme,
    EscalationRequest, EscalationResponse,
    EligibilityCheckRequest, EligibilityCheckResult,
    PageStudyRequest, PageStudyResult
)
from app.services.gemini_service import analyze_civic_grievance, study_website_page
from app.services.escalation_service import generate_statutory_escalation
from app.services.live_data_service import reverse_geocode_osm
from app.agent.browser_agent import execute_deterministic_playwright_filing
from app.providers.factory import get_scheme_provider
from app.db.database import get_grievance_by_tracking_id, list_all_grievances

router = APIRouter(prefix="/api/v1")

@router.post("/agent/study-page", response_model=PageStudyResult)
async def api_study_page(req: PageStudyRequest):
    """
    Website Page Study Endpoint:
    Inspects URL, title, and headings to generate dynamic, portal-tailored
    prompts, chips, and questions without hardcoded assumptions.
    """
    return study_website_page(req.url, req.title or "", req.headings or "", req.page_text or "")


@router.post("/grievance/analyze", response_model=GrievanceAnalysisResult)
async def api_analyze_grievance(req: GrievanceAnalysisRequest):
    """
    Multimodal Intake Endpoint:
    Processes speech transcripts/text, checks for PII/Aadhaar leaks,
    computes urgency scores and confidence, and identifies missing fields.
    """
    try:
        return await analyze_civic_grievance(
            raw_input=req.raw_input,
            language=req.language or "en",
            image_base64=req.image_base64,
            location=req.location,
            portal_context=req.portal_context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")

@router.post("/grievance/submit", response_model=GrievanceSubmissionResult)
async def api_submit_grievance(req: GrievanceSubmissionRequest):
    """
    Deterministic Filing Endpoint:
    Dispatches the Playwright script to populate known selectors on the mock portal.
    Requires explicit citizen confirmation (req.user_confirmed).
    """
    if not req.user_confirmed:
        raise HTTPException(
            status_code=400,
            detail="Safety Rule Violation: Grievance cannot be filed without explicit citizen confirmation."
        )

    # Duplicate check: check if an identical complaint was filed in the last 10 minutes
    recent_complaints = list_all_grievances(limit=10)
    for c in recent_complaints:
        if (c["category"] == req.category and 
            c["location"].lower() == req.location.lower() and
            c["citizen_name"].lower() == req.citizen.name.lower()):
            raise HTTPException(
                status_code=409,
                detail=f"Duplicate Complaint Detected: An identical grievance was already registered under Tracking ID #{c['tracking_id']}."
            )

    try:
        return await execute_deterministic_playwright_filing(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Filing error: {str(e)}")

@router.get("/grievance/list")
async def api_list_grievances(limit: int = 50):
    """Retrieves all active grievances from the SQLite database."""
    return list_all_grievances(limit=limit)

@router.get("/grievance/track/{tracking_id}")
async def api_track_grievance(tracking_id: str):
    """Returns tracking status, days elapsed, and assigned officer details."""
    record = get_grievance_by_tracking_id(tracking_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Tracking ID #{tracking_id} not found")
    return record

@router.post("/escalate", response_model=EscalationResponse)
async def api_escalate_complaint(req: EscalationRequest):
    """
    Escalation Studio:
    Generates structured Reminder letters, First Appeals (RPSA), or RTI applications
    for overdue grievances. Never sent automatically.
    """
    record = get_grievance_by_tracking_id(req.tracking_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Tracking ID #{req.tracking_id} not found")

    return generate_statutory_escalation(
        complaint=record,
        escalation_type=req.escalation_type,
        days_elapsed=req.days_elapsed
    )

@router.post("/fact-check", response_model=FactCheckResult)
async def api_fact_check_claim(req: FactCheckRequest):
    """
    3-Outcome Claim Verifier:
    Evaluates viral messages against verified scheme records.
    Outputs: 'matches', 'contradicts', or 'unverified' with exact source text.
    """
    provider = get_scheme_provider()
    result = await provider.verify_claim(req.claim)
    return FactCheckResult(
        claim=req.claim,
        outcome=result["outcome"],
        verdict=result["verdict"],
        truth_score=result["truth_score"],
        summary=result["summary"],
        exact_source_text=result["exact_source_text"],
        official_source_url=result["official_source_url"],
        last_verified_date=result["last_verified_date"],
        action_advice_for_citizens=result["action_advice"],
        matched_scheme_id=result.get("matched_scheme_id")
    )

@router.get("/schemes", response_model=List[NormalizedScheme])
async def api_get_schemes(
    category: str = Query("all", description="farmer, student, women, healthcare, senior, msme"),
    state: str = Query("All-India", description="State filter"),
    query: str = Query("", description="Keyword search")
):
    """
    Normalized Scheme Provider:
    Returns government schemes via API Setu or hand-verified local store.
    """
    provider = get_scheme_provider()
    return await provider.get_schemes(category=category, state=state, query=query)

@router.post("/schemes/eligibility", response_model=EligibilityCheckResult)
async def api_check_eligibility(req: EligibilityCheckRequest):
    """
    Non-definitive Eligibility Helper:
    Evaluates citizen profile against criteria and provides guidance.
    """
    provider = get_scheme_provider()
    all_schemes = await provider.get_schemes()
    
    likely_matches = []
    for s in all_schemes:
        match_reasons = []
        # Check occupation
        if req.occupation and req.occupation.lower() in s.category.lower():
            match_reasons.append(f"Matches category '{s.category}'")
        if req.landholder and s.category == "farmer":
            match_reasons.append("Eligible as landholder farmer")
        if req.gender == "female" and s.category == "women":
            match_reasons.append("Eligible under women empowerment initiative")
        if req.age and req.age >= 60 and s.category == "senior":
            match_reasons.append(f"Senior citizen criteria satisfied (Age {req.age})")

        if match_reasons:
            likely_matches.append({
                "scheme_id": s.id,
                "scheme_name": s.name,
                "official_url": s.official_url,
                "reasons": match_reasons,
                "status": "Likely Eligible",
                "next_step": f"Confirm exact documentation at {s.official_url}"
            })

    return EligibilityCheckResult(
        likely_eligible_schemes=likely_matches[:5],
        disclaimer="Non-definitive evaluation based on citizen-provided details. Always verify at official portal."
    )

@router.get("/geocode/reverse")
async def api_reverse_geocode(lat: float, lon: float):
    """Live OpenStreetMap reverse geocoding."""
    return await reverse_geocode_osm(lat, lon)
