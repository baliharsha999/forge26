import os
import json
import re
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from app.models.schemas import GrievanceAnalysisResult, ConfidenceScore
from app.services.privacy_service import inspect_and_sanitize_pii
from app.core.config import settings

# Initialize Google GenAI client if available (gemini-3.5-flash)
gemini_client = None
if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here":
    try:
        from google import genai
        gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options={"timeout": 10000})
    except Exception as e:
        print(f"Gemini Client Init Note: {e}")


def _call_groq_json(prompt: str) -> Optional[Dict[str, Any]]:
    """
    Ultra-fast LLM inference using Groq API (openai/gpt-oss-120b or qwen3.8-27b).
    """
    if not settings.GROQ_API_KEY:
        return None
    try:
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "NagarikAI-CivicEngine/1.0"
            },
            data=json.dumps({
                "model": settings.GROQ_MODEL,
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are Nagarik AI, an expert digital governance assistant empowering every citizen across India. "
                            "Analyze citizen complaints for municipal, state, or central (CPGRAMS) portals. "
                            "Return valid, clean JSON strictly adhering to the requested schema. Never output markdown fences."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.15
            }).encode("utf-8")
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        print(f"Groq API Call Note: {e}")
        return None


def _call_gemini_json(prompt: str) -> Optional[Dict[str, Any]]:
    """
    Secondary fallback using Google Gemini 3.5 Flash.
    """
    if not gemini_client:
        return None
    try:
        res = gemini_client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt
        )
        clean_text = res.text.strip()
        if clean_text.startswith("```"):
            clean_text = re.sub(r"^```(?:json)?\n", "", clean_text)
            clean_text = re.sub(r"\n```$", "", clean_text)
        return json.loads(clean_text)
    except Exception as e:
        print(f"Gemini API Call Note: {e}")
        return None


async def analyze_civic_grievance(
    raw_input: str,
    language: str = "en",
    image_base64: Optional[str] = None,
    location: Optional[str] = None,
    portal_context: Optional[str] = None
) -> GrievanceAnalysisResult:
    """
    Multimodal analysis of citizen voice transcripts, photos, or text.
    Enforces privacy checks (Aadhaar redaction), extracts strict JSON,
    and returns confidence metrics and follow-up prompts tailored to the portal.
    """
    # 1. Privacy & Sensitive PII Inspection
    sanitized_input, privacy_warning = inspect_and_sanitize_pii(raw_input)
    input_lower = sanitized_input.lower()
    
    prompt = f"""
    Analyze the following citizen complaint for public grievance registration:
    Input: "{sanitized_input}"
    Language: "{language}"
    Reported Location: "{location or ''}"
    Active Portal Context: "{portal_context or 'Public Grievance Portal'}"

    Determine the correct responsible department/ministry (e.g. Ministry of Railways, Department of Financial Services (Banking/Pension), Ministry of Road Transport, Municipal Water Board, Solid Waste Management, Civil Supplies/PDS, etc.).
    
    Return ONLY valid JSON matching this schema:
    {{
      "category": string,
      "department": string,
      "urgency_level": "HIGH" | "MEDIUM" | "LOW",
      "urgency_score": integer (1-10),
      "location_text": string,
      "description": string,
      "language": "{language}",
      "missing_fields": list of missing attributes,
      "confidence": {{ "category": float, "department": float, "location": float }},
      "follow_up_prompt": string or null,
      "actionable_remedy": string,
      "applicable_act_or_regulation": string
    }}
    """

    # Try 1: Groq (Blazing fast ~400ms, GPT-OSS 120B / Qwen)
    parsed = _call_groq_json(prompt)

    # Try 2: Gemini 3.5 Flash if Groq fails
    if not parsed:
        parsed = _call_gemini_json(prompt)

    # If an LLM succeeded, validate and return
    if parsed and isinstance(parsed, dict) and "department" in parsed and "category" in parsed:
        urgency = str(parsed.get("urgency_level", "HIGH")).upper()
        if urgency not in ["HIGH", "MEDIUM", "LOW"]:
            urgency = "HIGH"

        conf = parsed.get("confidence", {})
        loc = parsed.get("location_text", location or "Location pending citizen confirmation")
        if not loc or loc.strip() == "":
            loc = "Location pending citizen confirmation"

        return GrievanceAnalysisResult(
            category=parsed.get("category", "Public Redressal Inquiry"),
            department=parsed.get("department", "Concerned Public Authority"),
            urgency_level=urgency,
            urgency_score=int(parsed.get("urgency_score", 7)),
            location_text=loc,
            description=parsed.get("description", f"Citizen grievance regarding {sanitized_input}"),
            language=language,
            missing_fields=parsed.get("missing_fields", []),
            confidence=ConfidenceScore(
                category=float(conf.get("category", 0.95)),
                department=float(conf.get("department", 0.93)),
                location=float(conf.get("location", 0.88))
            ),
            follow_up_prompt=parsed.get("follow_up_prompt"),
            actionable_remedy=parsed.get("actionable_remedy", "Official verification and redressal by designated officer"),
            applicable_act_or_regulation=parsed.get("applicable_act_or_regulation", "Public Grievance Redressal Rules"),
            privacy_warning=privacy_warning
        )

    # 3. Resilient Local Rule Engine (Context-Aware, covers Central Ministries, Railways, Banking, Roads & Municipal)
    dept = "General Public Grievance Unit"
    category = "General Public Service Redressal"
    urgency_level = "HIGH"
    urgency_score = 7
    act = "Right to Public Services Act"
    remedy = "Immediate administrative review by supervisory authority"
    conf_cat = 0.88
    conf_dept = 0.86
    conf_loc = 0.85

    # Check Railways / IRCTC
    if any(k in input_lower for k in ["train", "irctc", "railway", "ticket", "refund", "coach", "pnr", "tdr", "berth"]):
        dept = "Ministry of Railways (Indian Railways)"
        category = "Passenger Services & Ticket Refund Grievance"
        urgency_level = "HIGH"
        urgency_score = 8
        act = "Indian Railways Act 1989 & Citizen Charter"
        remedy = "Instant verification of PNR / TDR status and electronic refund credit"
        conf_cat = 0.96
        conf_dept = 0.95
    # Check Banking / Pension
    elif any(k in input_lower for k in ["pension", "bank", "sbi", "atm", "branch", "account", "deduction", "life certificate", "jeevan"]):
        dept = "Department of Financial Services (Banking / Pension)"
        category = "Pension Disbursement & Banking Services Grievance"
        urgency_level = "HIGH"
        urgency_score = 8
        act = "Banking Ombudsman Scheme & Central Civil Services Pension Rules"
        remedy = "Immediate restoration of pension disbursal and branch audit"
        conf_cat = 0.95
        conf_dept = 0.94
    # Check Speed Post / Postal / Telecom
    elif any(k in input_lower for k in ["post", "speed post", "parcel", "bsnl", "broadband", "fiber", "telecom"]):
        dept = "Department of Posts & Telecommunications"
        category = "Postal Delay & Telecom Service Disruption"
        urgency_level = "MEDIUM"
        urgency_score = 6
        act = "Indian Post Office Act & TRAI Regulations"
        remedy = "Consignment tracking escalation and transit dispatch"
        conf_cat = 0.93
        conf_dept = 0.92
    # Check National Highways / Roads
    elif any(k in input_lower for k in ["highway", "national highway", "nh", "toll", "fastag", "crater"]):
        dept = "Ministry of Road Transport and Highways (MoRTH)"
        category = "National Highway Maintenance & Toll Plaza Grievance"
        urgency_level = "HIGH"
        urgency_score = 8
        act = "National Highways Act 1956 & NHAI Safety Guidelines"
        remedy = "Emergency asphalt patchwork repair and toll lane inspection"
        conf_cat = 0.94
        conf_dept = 0.93
    # Check Water / Leakage / Broken Wall
    elif any(k in input_lower for k in ["water", "leak", "sewage", "drain", "broken wall", "pipeline", "wall broken"]):
        dept = "Water Supply & Sewerage Board"
        category = "Drinking Water Contamination & Sewage Overflow"
        urgency_level = "HIGH"
        urgency_score = 9
        act = "Water (Prevention and Control of Pollution) Act 1974"
        remedy = "Dispatch emergency repair crew to isolate pipeline breach"
        conf_cat = 0.96
        conf_dept = 0.94
    # Check Potholes / Local Streets
    elif any(k in input_lower for k in ["pothole", "road", "street", "footpath", "tar"]):
        dept = "Roads & Municipal Infrastructure"
        category = "Dangerous Pothole & Road Hazard"
        urgency_level = "HIGH"
        urgency_score = 8
        act = "State Municipal Corporation Act"
        remedy = "Deploy road repair vehicle with hot-mix asphalt"
        conf_cat = 0.95
        conf_dept = 0.92
    # Check Electricity / Transformer
    elif any(k in input_lower for k in ["electric", "power", "spark", "transformer", "wire", "blackout", "shock"]):
        dept = "State Electricity Distribution Company (DISCOM)"
        category = "High Voltage Sparking & Power Safety Hazard"
        urgency_level = "HIGH"
        urgency_score = 9
        act = "Electricity Act 2003 (Section 68)"
        remedy = "Immediate feeder de-energization and line replacement"
        conf_cat = 0.97
        conf_dept = 0.95
    # Check Garbage
    elif any(k in input_lower for k in ["garbage", "trash", "waste", "dump", "bin", "smell", "sanitation"]):
        dept = "Solid Waste Management & Public Health"
        category = "Uncollected Garbage & Public Health Hazard"
        urgency_level = "MEDIUM"
        urgency_score = 6
        act = "Solid Waste Management Rules 2016"
        remedy = "Immediate deployment of mechanical compactor and sanitization crew"
        conf_cat = 0.92
        conf_dept = 0.90

    # Location extraction
    missing_fields = []
    follow_up = None
    extracted_loc = location or ""
    loc_match = re.search(r'(?:near|at|in|colony|ward|road|street|nagar|pillar|station|branch)\s+([A-Za-z0-9\s]+?)(?:\.|,|$)', sanitized_input, re.IGNORECASE)
    if loc_match:
        extracted_loc = loc_match.group(1).strip()
    
    if not extracted_loc or extracted_loc.strip() == "":
        extracted_loc = "Location pending citizen confirmation"
        missing_fields.append("location")
        conf_loc = 0.30
        follow_up = "Could you please specify your city, colony, or nearest landmark?"

    formal_summary = f"Citizen petition regarding {category.lower()} at {extracted_loc}. Citizen reports recurring disruption affecting public safety and daily life."

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


def study_website_page(url: str, title: str = "", headings: Any = "", page_text: str = "") -> Dict[str, Any]:
    """
    Dynamically analyzes the active webpage DOM, URL, and headings
    to understand what portal the citizen is browsing, and returns
    tailored greetings, chips, and authority labels without hardcoded assumptions.
    """
    if isinstance(headings, list):
        headings_str = " ".join(str(h) for h in headings)
    else:
        headings_str = str(headings or "")

    url_lower = (url or "").lower()
    title_lower = (title or "").lower()
    text_lower = (page_text or "").lower() + " " + headings_str.lower()

    # 0. Check if citizen is on a blank, search, or non-civic page (New Tab, Google, etc.)
    is_non_civic = (
        not url_lower or
        url_lower.startswith("chrome://") or
        url_lower.startswith("chrome-extension://") or
        url_lower.startswith("edge://") or
        url_lower.startswith("about:") or
        "google.com" in url_lower or
        "youtube.com" in url_lower or
        ":5173" in url_lower or
        title_lower in ["new tab", "google", "chrome"]
    )
    if is_non_civic:
        return {
            "portal_name": "No Civic Portal Active",
            "authority_name": "Standby Mode",
            "portal_type": "STANDBY",
            "welcome_greeting": "Namaste! Nagarik AI is in Standby mode. Please open CPGRAMS or your local municipal portal in your browser, or click a button below to launch one immediately.",
            "placeholder_text": "Open pgportal.gov.in or click a portal chip below to launch...",
            "chips": [
                {"label": "🏛️ Launch CPGRAMS (pgportal.gov.in)", "text": "OPEN_PORTAL:https://pgportal.gov.in"},
                {"label": "🏢 Launch Municipal Demo Portal", "text": "OPEN_PORTAL:http://localhost:8000/portal"},
                {"label": "🚆 Central Railway & IRCTC Grievance", "text": "OPEN_PORTAL:https://pgportal.gov.in"},
                {"label": "🏦 Bank Pension / Central Issue", "text": "OPEN_PORTAL:https://pgportal.gov.in"}
            ],
            "location_question": "Where is this related to? Tell me your city, station, or tap GPS.",
            "authority_label": "Concerned Authority",
            "has_form": False,
            "is_landing_page": True
        }

    if "pgportal.gov.in" in url_lower or "cpgrams" in title_lower or "administrative reforms" in title_lower:
        is_landing = (
            url_lower.rstrip("/").endswith("pgportal.gov.in") or 
            ("/home" in url_lower and "lodge" not in url_lower) or 
            ("signin" in url_lower or "login" in url_lower)
        )
        return {
            "portal_name": "Central Public Grievance Portal (CPGRAMS)",
            "authority_name": "Central Government of India",
            "portal_type": "CENTRAL_GOVERNMENT",
            "welcome_greeting": "Namaste! I have inspected CPGRAMS. This national portal covers Central Government departments like Railways, Banking & Pensions, Postal Services, and Highways. What issue do you need help lodging?",
            "placeholder_text": "Speak or type your grievance, e.g. 'IRCTC train refund of ₹1850 pending for 3 weeks' or 'bank stopped my father's pension'",
            "chips": [
                {"label": "🚆 Train Ticket Refund / IRCTC Delay", "text": "My train ticket was cancelled but IRCTC has not refunded ₹1850 for over 3 weeks. TDR filed but no response."},
                {"label": "🏦 Central Pension / Bank Delay", "text": "Monthly central pension halted by bank without notice despite submitting digital Jeevan Pramaan life certificate."},
                {"label": "📦 Speed Post / BSNL Telecom", "text": "Important registered speed post article has been stuck in transit for 15 days without tracking update."},
                {"label": "🚧 National Highway Crater / Fastag", "text": "Dangerous 2-foot pothole on National Highway near toll plaza causing vehicle accidents daily."}
            ],
            "location_question": "Where is this related to? (Your city, railway station, bank branch, or highway location) or tap GPS.",
            "authority_label": "Concerned Ministry",
            "has_form": not is_landing,
            "is_landing_page": is_landing
        }
    elif "portal" in url_lower or "municipal" in text_lower or "corporation" in text_lower or "ward" in text_lower:
        return {
            "portal_name": "Municipal Corporation Redressal Portal",
            "authority_name": "Municipal Corporation & Urban Development",
            "portal_type": "MUNICIPAL_CORPORATION",
            "welcome_greeting": "Namaste! I have inspected the Municipal Corporation Portal. This handles local civic amenities like water supply, roads, drainage, and streetlights. What civic issue can I help you file?",
            "placeholder_text": "Speak or type your issue, e.g. 'water supply pipeline leaking near my house' or 'dangerous road potholes'",
            "chips": [
                {"label": "🚰 Broken Wall / Pipeline Leakage", "text": "My house boundary wall is broken due to severe municipal main water pipeline leakage. Water is continuously seeping into foundation."},
                {"label": "🚧 Dangerous Road Potholes", "text": "Deep crater pothole near Main Road junction, two-wheelers skidding frequently."},
                {"label": "⚡ Transformer Sparking Hazard", "text": "High voltage transformer sparking near residential houses causing immediate fire risk."},
                {"label": "🗑️ Garbage Overflow & Sanitation", "text": "Garbage dump overflowing for 5 days attracting stray animals and blocking street."}
            ],
            "location_question": "Where did this problem happen? Tell me your street name, colony, or tap the GPS button.",
            "authority_label": "Responsible Department",
            "has_form": True,
            "is_landing_page": False
        }
    else:
        portal_name = title.strip() if title else "Public Service Portal"
        return {
            "portal_name": portal_name,
            "authority_name": "Public Redressal Authority",
            "portal_type": "CIVIC_PORTAL",
            "welcome_greeting": f"Namaste! I have studied {portal_name}. What issue or public service request can I help you file today?",
            "placeholder_text": "Speak or type your grievance or public service inquiry...",
            "chips": [
                {"label": "🚰 Water & Sanitation Grievance", "text": "Severe drinking water contamination and pipeline leakage in my locality."},
                {"label": "🚧 Road & Infrastructure Repair", "text": "Major road surface damage and non-functional streetlights."},
                {"label": "🏛️ Public Service & Scheme Query", "text": "Application for civic certificate is pending beyond citizen charter timeline."},
                {"label": "⚡ Electricity & Utility Disruption", "text": "Frequent unannounced power cuts and low voltage damaging home appliances."}
            ],
            "location_question": "Where did this happen? (Your street, colony, ward, or city) or tap GPS.",
            "authority_label": "Concerned Department",
            "has_form": True,
            "is_landing_page": False
        }
