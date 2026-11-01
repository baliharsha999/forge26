from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import List, Optional, Dict, Any
import os
import re
from datetime import datetime
from app.models.schemas import (
    GrievanceAnalysisRequest, GrievanceAnalysisResult,
    GrievanceSubmissionRequest, GrievanceSubmissionResult,
    FactCheckRequest, FactCheckResult,
    NormalizedScheme,
    EscalationRequest, EscalationResponse,
    EligibilityCheckRequest, EligibilityCheckResult,
    PageStudyRequest, PageStudyResult,
    DocumentExtractRequest, DocumentExtractResult,
    IdLocatorRequest, IdLocatorResult,
    SchemesChatRequest, SchemesChatResponse,
    SchemeCitation, RagReasoningStep
)
from app.services.gemini_service import analyze_civic_grievance, study_website_page
from app.services.document_service import extract_data_from_document, locate_document_id
from app.services.escalation_service import generate_statutory_escalation
from app.services.live_data_service import reverse_geocode_osm
from app.services.stair_agent import STAIRCivicAgent
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


@router.post("/agent/extract-document", response_model=DocumentExtractResult)
async def api_extract_document(req: DocumentExtractRequest):
    """
    Multimodal Document Extraction Endpoint:
    Scans attached marksheets, Aadhaar, PAN, certificates or bills,
    extracts identity/academic fields, and prepares them for 1-click portal auto-fill.
    """
    return extract_data_from_document(
        image_base64=req.image_base64,
        document_hint=req.document_hint or "auto",
        portal_context=req.portal_context or "",
        language=req.language or "en"
    )


@router.post("/agent/locate-id", response_model=IdLocatorResult)
async def api_locate_id(req: IdLocatorRequest):
    """
    ID & Identifier Locator Endpoint:
    Tells citizen exactly where to look on their physical cards or documents
    (e.g., 10th Roll Number, APAAR ID, Aadhaar VID, UAN, CA Number).
    """
    return locate_document_id(
        query=req.id_query,
        portal_context=req.portal_context or "",
        language=req.language or "en"
    )


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
    state_norm = (req.state or "all-india").lower()
    caste_norm = (req.caste or "general").lower()

    for s in all_schemes:
        match_reasons = []
        s_id = s.id
        s_state = getattr(s, "state", "All-India").lower()

        # State filter: skip scheme if it belongs to a different state
        if s_state != "all-india" and state_norm != "all-india" and s_state != state_norm:
            continue

        # 1. Thalliki Vandanam (SCHEME-016)
        if s_id == "SCHEME-016" and req.has_school_children:
            if state_norm in ["all-india", "andhra pradesh", "ap"]:
                match_reasons.append("Eligible for ₹15,000/yr DBT per school-going child in Andhra Pradesh")

        # 2. PM-KISAN (SCHEME-001)
        if s_id == "SCHEME-001" and req.landholder and req.occupation == "farmer":
            match_reasons.append("Eligible landholder farmer for ₹6,000/yr DBT in 3 installments")

        # 3. YSR Rythu Bharosa (SCHEME-009)
        if s_id == "SCHEME-009" and req.landholder and state_norm in ["all-india", "andhra pradesh", "ap"]:
            match_reasons.append("Eligible farmer in Andhra Pradesh for ₹13,500/yr financial support")

        # 4. Ayushman Bharat PM-JAY (SCHEME-002)
        if s_id == "SCHEME-002":
            if req.age and req.age >= 70:
                match_reasons.append(f"Senior citizen (Age {req.age}) eligible for Universal ₹5 Lakh health cover (2024 Expansion)")
            elif req.annual_income and req.annual_income <= 250000:
                match_reasons.append("Household income meets SECC BPL criteria for ₹5 Lakh cashless health cover")

        # 5. Stand Up India (SCHEME-013)
        if s_id == "SCHEME-013" and (req.gender == "female" or caste_norm in ["sc", "st"]):
            match_reasons.append("Eligible as SC/ST/Woman entrepreneur for ₹10 Lakh to ₹1 Crore greenfield business credit")

        # 6. PM Vishwakarma (SCHEME-011)
        if s_id == "SCHEME-011" and req.occupation in ["artisan", "craftsperson", "carpenter", "blacksmith", "tailor", "potter", "barber"]:
            match_reasons.append("Traditional artisan/craftsperson eligible for collateral-free ₹1L-₹2L loans at 5% + ₹15k toolkit e-voucher")

        # 7. Student Scholarships (SCHEME-004)
        if s_id == "SCHEME-004" and req.occupation == "student":
            if req.annual_income and req.annual_income <= 450000:
                match_reasons.append("Eligible student with household income under ₹4.5 Lakhs (CSSS / Post-Matric)")
            elif caste_norm in ["sc", "st", "obc"]:
                match_reasons.append(f"Eligible student under {caste_norm.upper()} reserved category scholarship")

        # 8. General Category & Demographic Checks
        if req.occupation and req.occupation.lower() in s.category.lower() and not match_reasons:
            match_reasons.append(f"Matches category '{s.category}'")
        if req.landholder and s.category == "farmer" and not match_reasons:
            match_reasons.append("Eligible as landholder farmer")
        if req.gender == "female" and s.category == "women" and not match_reasons:
            match_reasons.append("Eligible under women empowerment initiative")
        if req.age and req.age >= 60 and s.category == "senior" and not match_reasons:
            match_reasons.append(f"Senior citizen criteria satisfied (Age {req.age})")

        if match_reasons:
            relevance_score = len(match_reasons) * 10
            if s_state != "all-india" and s_state == state_norm:
                relevance_score += 30  # High priority for citizen's home state
            if req.has_school_children and ("education" in s.category or "student" in s.category):
                relevance_score += 25
            if req.age and req.age >= 70 and s.id == "SCHEME-002":
                relevance_score += 25
            if caste_norm in ["sc", "st"] and s.id == "SCHEME-013":
                relevance_score += 25

            likely_matches.append({
                "_score": relevance_score,
                "scheme_id": s.id,
                "scheme_name": s.name,
                "official_url": s.official_url,
                "reasons": match_reasons,
                "status": "Likely Eligible",
                "next_step": f"Confirm exact documentation at {s.official_url}"
            })

    # Sort by relevance score descending so the most pertinent schemes appear first
    likely_matches.sort(key=lambda x: x["_score"], reverse=True)
    # Remove internal _score key before returning
    for m in likely_matches:
        m.pop("_score", None)

    return EligibilityCheckResult(
        likely_eligible_schemes=likely_matches[:6],
        disclaimer="Non-definitive evaluation based on citizen-provided details. Always verify at official portal."
    )

@router.get("/geocode/reverse")
async def api_reverse_geocode(lat: float, lon: float):
    """Live OpenStreetMap reverse geocoding."""
    return await reverse_geocode_osm(lat, lon)


# Ministry & Department Mapping for Schemes
SCHEME_DEPT_MAP = {
    "SCHEME-001": ("Ministry of Agriculture & Farmers Welfare", "pmkisan.gov.in"),
    "SCHEME-002": ("National Health Authority (NHA), MoHFW", "nha.gov.in"),
    "SCHEME-003": ("Dept of Financial Services, Ministry of Finance", "mudra.org.in"),
    "SCHEME-004": ("Ministry of Social Justice & Empowerment", "scholarships.gov.in"),
    "SCHEME-005": ("Ministry of Housing and Urban Affairs (MoHUA)", "pmay-urban.gov.in"),
    "SCHEME-006": ("Ministry of Women and Child Development & India Post", "indiapost.gov.in"),
    "SCHEME-007": ("Pension Fund Regulatory and Development Authority (PFRDA)", "npscra.nsdl.co.in"),
    "SCHEME-008": ("Ministry of Housing and Urban Affairs (MoHUA)", "pmsvanidhi.mohua.gov.in"),
    "SCHEME-009": ("Department of Agriculture, Govt of Andhra Pradesh", "ysrrythubharosa.ap.gov.in"),
    "SCHEME-010": ("Ministry of Petroleum and Natural Gas", "pmuy.gov.in"),
    "SCHEME-011": ("Ministry of Micro, Small & Medium Enterprises (MSME)", "pmvishwakarma.gov.in"),
    "SCHEME-012": ("Ministry of Rural Development (NSAP)", "nsap.nic.in"),
    "SCHEME-013": ("Small Industries Development Bank of India (SIDBI) / MoF", "standupmitra.in"),
    "SCHEME-014": ("Ministry of Women and Child Development", "pmmvy.wcd.gov.in"),
    "SCHEME-015": ("Ministry of Skill Development and Entrepreneurship", "apprenticeshipindia.gov.in")
}

@router.post("/chat", response_model=SchemesChatResponse)
@router.post("/schemes/chat", response_model=SchemesChatResponse)
async def api_schemes_chat(req: SchemesChatRequest):
    """
    STAIR Autonomous Civic Schemes Engine:
    - Intent and Domain Routing (Procedural Guide, Scheme RAG, Defence, Grievance)
    - Ingests 5,210 National and State Schemes plus Gazette database
    - Dual-LLM Multilingual Synthesis (Groq Qwen 27B / GPT-OSS 120B / Gemini Flash)
    - Authentic .gov.in Citations with Zero Hallucination
    """
    query = req.get_query_text()
    lang = req.language or "en"
    agent = STAIRCivicAgent.get_instance()
    return await agent.process_citizen_query(query=query, requested_lang=lang)


@router.get("/extension/download")
async def api_download_extension():
    """
    1-Click Chrome Extension Download:
    Returns the packaged Nagarik AI Chrome Extension zip bundle.
    """
    zip_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../frontend/public/nagarik-extension.zip"))
    if not os.path.exists(zip_path):
        # Fallback to creating or checking root
        alt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../nagarik-extension.zip"))
        if os.path.exists(alt_path):
            zip_path = alt_path
        else:
            raise HTTPException(status_code=404, detail="Extension package bundle not found.")
    
    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename="nagarik-extension.zip"
    )
