import os
import json
import re
from typing import Dict, Any, Optional
from app.models.schemas import GrievanceAnalysisResult, ConfidenceScore
from app.services.privacy_service import inspect_and_sanitize_pii
from app.core.config import settings

gemini_client = None
if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here":
    try:
        from google import genai
        gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        print(f"Gemini Client Init Notice: {e}")

async def analyze_civic_grievance(
    raw_input: str,
    language: str = "en",
    image_base64: Optional[str] = None,
    location: Optional[str] = None
) -> GrievanceAnalysisResult:
    """
    Multimodal analysis of citizen voice transcripts, photos, or text.
    Enforces privacy checks (Aadhaar redaction), extracts strict JSON,
    and returns confidence metrics and follow-up prompts when details are sparse.
    """
    # 1. Privacy & Sensitive PII Inspection
    sanitized_input, privacy_warning = inspect_and_sanitize_pii(raw_input)
    input_lower = sanitized_input.lower()
    
    # 2. Try Gemini GenAI if available
    if gemini_client:
        try:
            prompt = f"""
            You are JanSetu AI, an expert digital governance assistant.
            Analyze the following citizen complaint:
            Input: "{sanitized_input}"
            Language: "{language}"
            Reported Location: "{location or ''}"

            Return ONLY valid JSON matching this schema:
            {{
              "category": string,
              "department": string,
              "urgency_level": "HIGH" | "MEDIUM" | "LOW",
              "urgency_score": integer (1-10),
              "location_text": string,
              "description": string,
              "language": "{language}",
              "missing_fields": list of missing attributes (e.g. "location", "contact"),
              "confidence": {{ "category": float, "department": float, "location": float }},
              "follow_up_prompt": string or null,
              "actionable_remedy": string,
              "applicable_act_or_regulation": string
            }}
            """
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            data["privacy_warning"] = privacy_warning
            return GrievanceAnalysisResult(**data)
        except Exception as e:
            print(f"Gemini API fallback to local NLP engine: {e}")

    # 3. Deterministic Resilient NLP Classifier
    dept = "Municipal Corporation & Public Works"
    category = "General Civic Grievance"
    urgency_level = "MEDIUM"
    urgency_score = 5
    act = "Right to Public Services Act & Municipal Corporation Administration Standards"
    remedy = "Ward engineer on-site inspection within 48 hours"
    conf_cat = 0.90
    conf_dept = 0.88
    conf_loc = 0.85

    if any(k in input_lower for k in ["road", "pothole", "crater", "gaddha", "sadak", "traffic", "dhamar", "guntalu"]):
        dept = "Municipal Corporation & Public Works"
        category = "Damaged Roadway & Dangerous Potholes"
        urgency_level = "HIGH"
        urgency_score = 8
        act = "Motor Vehicles Act & Municipal Corporation Act (Road Maintenance Standards)"
        remedy = "Emergency bitumen road patching and safety barricading"
        conf_cat = 0.96
        conf_dept = 0.94
    elif any(k in input_lower for k in ["water", "pani", "neellu", "leakage", "drain", "sewage", "gutter", "moruki"]):
        dept = "Water Supply & Sewerage Board"
        category = "Drinking Water Contamination & Sewage Overflow"
        urgency_level = "HIGH"
        urgency_score = 9
        act = "Water (Prevention and Control of Pollution) Act & Public Health Sanitation Rules"
        remedy = "Emergency desilting, sewage pipeline repair, and water quality testing"
        conf_cat = 0.97
        conf_dept = 0.95
    elif any(k in input_lower for k in ["current", "bijli", "power", "transformer", "spark", "wire", "voltage", "blackout", "vidyuth"]):
        dept = "State Electricity Distribution Company (DISCOM)"
        category = "Power Failure & Transformer Sparking Hazard"
        urgency_level = "HIGH"
        urgency_score = 9
        act = "The Electricity Act 2003 (Standards of Performance Regulation)"
        remedy = "Emergency lineman dispatch, load balance check, and transformer unit overhaul"
        conf_cat = 0.98
        conf_dept = 0.96
    elif any(k in input_lower for k in ["garbage", "kachra", "dump", "dustbin", "waste", "smell", "cleanness"]):
        dept = "Solid Waste Management & Public Health"
        category = "Uncollected Garbage & Public Health Hazard"
        urgency_level = "MEDIUM"
        urgency_score = 6
        act = "Solid Waste Management Rules 2016"
        remedy = "Immediate deployment of mechanical compactor and sanitization crew"
        conf_cat = 0.92
        conf_dept = 0.90
    elif any(k in input_lower for k in ["ration", "pds", "dealer", "rice", "card", "quota", "aadhaar"]):
        dept = "Civil Supplies & Consumer Affairs"
        category = "PDS Ration Denial / Fair Price Shop Irregularity"
        urgency_level = "MEDIUM"
        urgency_score = 7
        act = "National Food Security Act (NFSA) 2013"
        remedy = "Inquiry by Assistant Supply Officer (ASO) into dealer biometric and stock ledger"
        conf_cat = 0.91
        conf_dept = 0.89

    # Location extraction
    missing_fields = []
    follow_up = None
    extracted_loc = location or ""
    loc_match = re.search(r'(?:near|at|in|colony|ward|road|street|nagar|pillar)\s+([A-Za-z0-9\s]+?)(?:\.|,|$)', sanitized_input, re.IGNORECASE)
    if loc_match:
        extracted_loc = loc_match.group(1).strip()
    
    if not extracted_loc or extracted_loc.strip() == "":
        extracted_loc = "Location pending citizen confirmation"
        missing_fields.append("location")
        conf_loc = 0.30
        follow_up = "Could you please specify your street name, colony, or nearest landmark so the municipal team can locate the issue?"

    formal_summary = f"Citizen petition regarding {category.lower()} at {extracted_loc}. Citizen reports recurring disruption affecting local safety and daily public life."

    return GrievanceAnalysisResult(
        category=category,
        department=dept,
        urgency_level=urgency_level,
        urgency_score=urgency_score,
        location_text=extracted_loc,
        description=formal_summary,
        language=language,
        missing_fields=missing_fields,
        confidence=ConfidenceScore(category=conf_cat, department=conf_dept, location=conf_loc),
        follow_up_prompt=follow_up,
        actionable_remedy=remedy,
        applicable_act_or_regulation=act,
        privacy_warning=privacy_warning
    )
