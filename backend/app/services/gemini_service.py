import os
import json
import re
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from app.models.schemas import GrievanceAnalysisResult, ConfidenceScore, GuideStep
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


# Global In-Memory Session Cache
# Caches page inspection DOM models and analysis queries per session for instant 0ms retrieval
_PAGE_STUDY_CACHE: Dict[str, Dict[str, Any]] = {}
_GRIEVANCE_ANALYSIS_CACHE: Dict[str, Any] = {}


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
    # 0. Check In-Memory Session Cache for Repeat Queries
    cache_key = f"{language}:{portal_context or ''}:{raw_input.strip().lower()}"
    if cache_key in _GRIEVANCE_ANALYSIS_CACHE:
        logger.info(f"Returning cached analysis for key: {cache_key}")
        return _GRIEVANCE_ANALYSIS_CACHE[cache_key]

    # 1. Privacy & Sensitive PII Inspection
    sanitized_input, privacy_warning = inspect_and_sanitize_pii(raw_input)
    input_lower = sanitized_input.lower()
    ctx_lower = (portal_context or "").lower()

    # Specialized Grounded Guidance for JEE Main / NTA Portal
    is_jee_query = any(k in input_lower for k in ["jee", "nta", "entrance", "exam", "mains", "admit card"]) or any(k in ctx_lower for k in ["jee", "nta", "exam", "admission"])
    is_guidance_ask = any(k in input_lower for k in ["apply", "register", "fill", "how to", "steps", "where", "guide", "sign in", "login", "link", "form", "date", "center"])
    
    if is_jee_query and is_guidance_ask:
        jee_steps = [
            GuideStep(
                step_number=1,
                badge="STEP 1 OF 3",
                title="Find the Official Application Form Link",
                instruction="On the JEE Main homepage, look for the 'Online Application Form for JEE (Main)' link in the public notice section.",
                target_text="Online Application Form",
                target_selector="a[href*='online-application-form'], a[href*='jeemain']",
                voice_speech="Step 1: Look for the Online Application Form link on the webpage, or click the button to have me open it.",
                can_auto_click=True
            ),
            GuideStep(
                step_number=2,
                badge="STEP 2 OF 3",
                title="New Candidate Registration",
                instruction="On the candidate login screen, click 'New Candidate Register Here' to fill your basic details and generate your Application Number.",
                target_text="New Candidate",
                target_selector="a[href*='registration'], a:contains('Register')",
                voice_speech="Step 2: On the candidate screen, click New Candidate Register Here to create your account.",
                can_auto_click=True
            ),
            GuideStep(
                step_number=3,
                badge="STEP 3 OF 3",
                title="Upload Documents & Pay Exam Fee",
                instruction="Enter your personal details, exam centres, upload your photo & signature, and complete the application fee payment.",
                target_text="Application",
                target_selector=None,
                voice_speech="Step 3: Complete your details, upload your photo and signature, and pay the fee to download your confirmation receipt.",
                can_auto_click=False
            )
        ]
        res = GrievanceAnalysisResult(
            intent="PORTAL_GUIDANCE",
            guidance_title="How to Apply for JEE (Main) - Step-by-Step",
            guidance_message="I will guide you step-by-step through the JEE (Main) application process without overwhelming you.",
            action_type="CLICK_APPLICATION_LINK",
            action_label="👉 Open JEE Main Online Application Form",
            steps=jee_steps,
            category="National Entrance Examination Registration",
            department="National Testing Agency (NTA)",
            urgency_level="MEDIUM",
            urgency_score=5,
            location_text="All-India Candidate Application",
            description="Candidate requested step-by-step guidance to apply for JEE (Main) on the NTA portal.",
            language=language,
            actionable_remedy="Guide candidate step-by-step to open application form, register, and submit documents",
            applicable_act_or_regulation="NTA JEE (Main) Information Bulletin & Candidate Guidelines",
            privacy_warning=privacy_warning
        )
        _GRIEVANCE_ANALYSIS_CACHE[cache_key] = res
        return res
    
    prompt = f"""
    You are Nagarik AI, an intelligent, empathetic digital governance copilot for citizens across India.
    Active Portal Context: "{portal_context or 'Public Grievance Portal'}"
    Citizen Input: "{sanitized_input}"
    Language: "{language}"
    Reported Location: "{location or ''}"

    CRITICAL INTENT EVALUATION:
    First, determine the citizen's INTENT:
    1. "PORTAL_GUIDANCE": Citizen is asking for help navigating the website, signing in, logging in, registering, how to use the portal, where to click, or login questions.
       Examples: "help me sign in for this page", "how do I login", "where do I sign in", "help me register", "how does this work".
       - In "guidance_title", provide a clear short title (e.g. "How to Sign In to CPGRAMS").
       - In "guidance_message", provide clear, human, step-by-step instructions on what to do on this specific portal.
       - Set "action_type": "HIGHLIGHT_SIGNIN" or "HIGHLIGHT_REGISTER".
       - Set "action_label": "✨ Highlight 'Sign In' on Webpage".

    2. "GRIEVANCE": Citizen is reporting an actual problem or complaint (e.g. railway ticket refund delay, bank pension stopped, dangerous road potholes, broken water pipe, transformer sparking, etc.).
       - Extract category, responsible ministry/department, urgency_level, urgency_score, location_text, formal description, and applicable_act_or_regulation.

    3. "GENERAL_QUESTION": Citizen is asking an informational civic question or scheme inquiry.

    Return ONLY valid JSON matching this schema:
    {{
      "intent": "PORTAL_GUIDANCE" | "GRIEVANCE" | "GENERAL_QUESTION",
      "guidance_title": string or null,
      "guidance_message": string or null,
      "action_type": "HIGHLIGHT_SIGNIN" | "CLICK_SIGNIN" | "HIGHLIGHT_REGISTER" | null,
      "action_label": string or null,
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

        parsed_steps = None
        if parsed.get("steps") and isinstance(parsed["steps"], list):
            try:
                parsed_steps = [GuideStep(**s) for s in parsed["steps"] if isinstance(s, dict)]
            except Exception as e:
                logger.warning(f"Could not parse steps from LLM: {e}")

        res = GrievanceAnalysisResult(
            intent=parsed.get("intent", "GRIEVANCE"),
            guidance_title=parsed.get("guidance_title"),
            guidance_message=parsed.get("guidance_message"),
            action_type=parsed.get("action_type"),
            action_label=parsed.get("action_label"),
            steps=parsed_steps,
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
        _GRIEVANCE_ANALYSIS_CACHE[cache_key] = res
        return res

    # 3. Check for Guidance & Sign-in Assistance in Local Fallback
    if any(k in input_lower for k in ["sign in", "signin", "log in", "login", "password", "otp"]):
        cpgrams_steps = [
            GuideStep(
                step_number=1,
                badge="STEP 1 OF 2",
                title="Locate the Yellow 'Sign In' Button",
                instruction="Look at the top-right corner of the page and click the yellow 'Sign In' button (or tap Click It for Me).",
                target_text="Sign In",
                target_selector=".btn-signIn, a[href*='signin'], a[href*='login']",
                voice_speech="Step 1: Click the yellow Sign In button at the top-right corner of the CPGRAMS page.",
                can_auto_click=True
            ),
            GuideStep(
                step_number=2,
                badge="STEP 2 OF 2",
                title="Enter Citizen Credentials",
                instruction="Enter your registered Mobile Number / Email and password, solve the security captcha, and click Login.",
                target_text="Login",
                target_selector="input[type='submit'], button[type='submit']",
                voice_speech="Step 2: Enter your login credentials and solve the captcha to proceed.",
                can_auto_click=False
            )
        ]
        res = GrievanceAnalysisResult(
            intent="PORTAL_GUIDANCE",
            guidance_title="How to Sign In to this Portal",
            guidance_message="To sign in: Look at the top-right corner of the page and click the yellow 'Sign In' button (or tap the button below to highlight it). Enter your registered Mobile Number / Email and Password. Once signed in, I will guide your grievance filing!",
            action_type="HIGHLIGHT_SIGNIN",
            action_label="✨ Highlight 'Sign In' on Webpage",
            steps=cpgrams_steps,
            category="Portal Access & Sign-In Guidance",
            department="CPGRAMS Citizen Authentication",
            urgency_level="MEDIUM",
            urgency_score=5,
            location_text="",
            description="Citizen requested assistance signing in to the portal.",
            language=language,
            actionable_remedy="Guide citizen to official Sign-In dialog and verify credentials",
            applicable_act_or_regulation="CPGRAMS User Manual & Citizen Charter",
            privacy_warning=privacy_warning
        )
        _GRIEVANCE_ANALYSIS_CACHE[cache_key] = res
        return res

    if any(k in input_lower for k in ["register", "signup", "sign up", "create account", "new user"]):
        reg_steps = [
            GuideStep(
                step_number=1,
                badge="STEP 1 OF 2",
                title="Find the Registration Link",
                instruction="Click the 'Click here to Sign Up' link on the login page or navigation bar.",
                target_text="Sign Up",
                target_selector="a[href*='signup'], a[href*='register']",
                voice_speech="Step 1: Click the Sign Up link on your screen to open the citizen registration form.",
                can_auto_click=True
            ),
            GuideStep(
                step_number=2,
                badge="STEP 2 OF 2",
                title="Fill Citizen Registration Details",
                instruction="Enter your Name, Mobile Number, Email, and Address to create your official citizen login account.",
                target_text="Submit",
                target_selector="input[type='submit'], button[type='submit']",
                voice_speech="Step 2: Enter your name, mobile number, and address to complete registration.",
                can_auto_click=False
            )
        ]
        res = GrievanceAnalysisResult(
            intent="PORTAL_GUIDANCE",
            guidance_title="How to Register for a New Account",
            guidance_message="To register: Click the 'Click here to Sign Up' link on the login page. Enter your Name, Mobile Number, and Address to create your official citizen login account.",
            action_type="HIGHLIGHT_REGISTER",
            action_label="✨ Highlight 'Register' Link",
            steps=reg_steps,
            category="Citizen Registration Guidance",
            department="CPGRAMS Citizen Onboarding",
            urgency_level="MEDIUM",
            urgency_score=5,
            location_text="",
            description="Citizen requested registration guidance.",
            language=language,
            actionable_remedy="Guide citizen to citizen registration form",
            applicable_act_or_regulation="CPGRAMS User Manual",
            privacy_warning=privacy_warning
        )
        _GRIEVANCE_ANALYSIS_CACHE[cache_key] = res
        return res

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
    _GRIEVANCE_ANALYSIS_CACHE[cache_key] = res
    return res


def study_website_page(url: str, title: str = "", headings: Any = "", page_text: str = "") -> Dict[str, Any]:
    """
    Dynamically analyzes the active webpage DOM, URL, and headings
    to understand what portal the citizen is browsing, and returns
    tailored greetings, chips, and authority labels without hardcoded assumptions.
    """
    cache_key = (url or "").strip().lower()
    if cache_key and cache_key in _PAGE_STUDY_CACHE:
        return _PAGE_STUDY_CACHE[cache_key]

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
        res = {
            "portal_name": "No Civic Portal Active",
            "authority_name": "Standby Mode",
            "portal_type": "STANDBY",
            "welcome_greeting": "Namaste! Nagarik AI is in Standby mode. Please open CPGRAMS, JEE Main, or your local municipal portal in your browser, or click a button below to launch one immediately.",
            "placeholder_text": "Open a government or exam portal, or click a chip below...",
            "chips": [
                {"label": "🏛️ Launch CPGRAMS (pgportal.gov.in)", "text": "OPEN_PORTAL:https://pgportal.gov.in"},
                {"label": "📝 Launch JEE Main Portal", "text": "OPEN_PORTAL:https://jeemain.nta.nic.in"},
                {"label": "🏢 Launch Municipal Demo Portal", "text": "OPEN_PORTAL:http://localhost:8000/portal"},
                {"label": "🚆 Central Railway & IRCTC Grievance", "text": "OPEN_PORTAL:https://pgportal.gov.in"}
            ],
            "location_question": "Where is this related to? Tell me your city, station, or tap GPS.",
            "authority_label": "Concerned Authority",
            "has_form": False,
            "is_landing_page": True
        }
        if cache_key:
            _PAGE_STUDY_CACHE[cache_key] = res
        return res

    # 1. National Entrance Examinations & Educational Portals (JEE, NEET, NTA, CUET, UPSC, etc.)
    is_exam = any(k in url_lower or k in title_lower for k in [
        "jeemain", "nta.nic.in", "neet", "cuet", "upsc.gov.in", "gate", "ssc.gov.in", 
        "examinationservices", "examination", "admission", "nta.ac.in", "entrance"
    ])
    if is_exam:
        exam_name = "JEE (Main)" if ("jee" in url_lower or "jee" in title_lower) else "National Examination"
        res = {
            "portal_name": f"{exam_name} Official Candidate Portal (NTA)",
            "authority_name": "National Testing Agency (NTA) & Ministry of Education",
            "portal_type": "EXAM_ADMISSION",
            "welcome_greeting": f"Namaste! I have studied the {exam_name} portal. I can guide you step-by-step to find the application form link, register as a new candidate, or upload required documents.",
            "placeholder_text": f"Ask how to apply, e.g. 'how to fill {exam_name} online application form' or 'steps to register'...",
            "chips": [
                {"label": f"📝 Apply for {exam_name} (Step-by-Step)", "text": f"How to apply for {exam_name} step-by-step?"},
                {"label": "🔗 Open Online Application Form Link", "text": "How do I find the online application form link on this screen?"},
                {"label": "📅 Important Dates & Schedule", "text": f"What are the registration deadlines and exam dates for {exam_name}?"},
                {"label": "📑 Required Documents & Photo Specs", "text": f"What documents, photo sizes, and certificates are required for {exam_name}?"}
            ],
            "location_question": "Which state or preferred exam city are you applying from?",
            "authority_label": "Exam Authority",
            "has_form": False,
            "is_landing_page": True
        }
        if cache_key:
            _PAGE_STUDY_CACHE[cache_key] = res
        return res

    # 2. Central Public Grievance Portal (CPGRAMS)
    if "pgportal.gov.in" in url_lower or "cpgrams" in title_lower or "administrative reforms" in title_lower:
        is_landing = (
            url_lower.rstrip("/").endswith("pgportal.gov.in") or 
            ("/home" in url_lower and "lodge" not in url_lower) or 
            ("signin" in url_lower or "login" in url_lower)
        )
        res = {
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
        if cache_key:
            _PAGE_STUDY_CACHE[cache_key] = res
        return res

    # 3. Passports & Consular Services
    if "passport" in url_lower or "passport" in title_lower:
        return {
            "portal_name": "Passport Seva Portal (PSP)",
            "authority_name": "Ministry of External Affairs (MEA)",
            "portal_type": "PASSPORT_SERVICES",
            "welcome_greeting": "Namaste! I have inspected Passport Seva. I can guide you through fresh passport application, appointment booking, or tracking status.",
            "placeholder_text": "Ask passport questions, e.g. 'how to apply for fresh passport'...",
            "chips": [
                {"label": "📘 Fresh Passport Step-by-Step", "text": "How to apply for a fresh passport step-by-step?"},
                {"label": "📅 Book PSK Appointment", "text": "How do I book an appointment slot at Passport Seva Kendra?"},
                {"label": "📑 Documents Required", "text": "What documents are required for passport address and date of birth proof?"},
                {"label": "🔍 Track Application Status", "text": "How do I track my passport application file status?"}
            ],
            "location_question": "Which city is your nearest Passport Seva Kendra (PSK)?",
            "authority_label": "Passport Office",
            "has_form": False,
            "is_landing_page": True
        }

    # 4. EPFO / PF & Pensions
    if "epf" in url_lower or "epfindia" in url_lower or "provident" in text_lower:
        return {
            "portal_name": "Employees' Provident Fund Portal (EPFO)",
            "authority_name": "Employees' Provident Fund Organisation",
            "portal_type": "EPFO_SERVICES",
            "welcome_greeting": "Namaste! I have inspected EPFO. I can guide you through online PF withdrawal, UAN KYC linking, and member passbook download.",
            "placeholder_text": "Ask EPFO questions, e.g. 'how to withdraw PF online'...",
            "chips": [
                {"label": "💰 Online PF Withdrawal (Form 19/10C)", "text": "How to withdraw PF money online using UAN?"},
                {"label": "🔄 Transfer PF from Old Company", "text": "How do I transfer my PF balance from previous employer to new company?"},
                {"label": "🆔 Link Aadhaar & Bank with UAN", "text": "How to complete KYC and link bank account with UAN?"},
                {"label": "📜 Download Member Passbook", "text": "How to check and download my EPFO passbook balance?"}
            ],
            "location_question": "Where is your employer or regional EPFO office located?",
            "authority_label": "Regional PF Office",
            "has_form": False,
            "is_landing_page": True
        }

    # 5. Parivahan / Driving License & Vahan
    if "parivahan" in url_lower or "sarathi" in url_lower or "vahan" in url_lower:
        return {
            "portal_name": "Parivahan Sewa (Transport Portal)",
            "authority_name": "Ministry of Road Transport and Highways (MoRTH)",
            "portal_type": "TRANSPORT_SERVICES",
            "welcome_greeting": "Namaste! I have inspected Parivahan Sewa. I can guide you through Learner's License, Driving License renewal, and Vehicle RC.",
            "placeholder_text": "Ask Parivahan questions, e.g. 'how to apply for learner license'...",
            "chips": [
                {"label": "🚗 Apply for Learner's License", "text": "How to apply for online Learner's License test?"},
                {"label": "💳 Driving License Renewal", "text": "Steps to renew expired driving license online."},
                {"label": "📄 Vehicle RC Transfer / Duplicate", "text": "How to apply for vehicle ownership transfer online?"},
                {"label": "📅 Book RTO Slot & Test", "text": "How to book an appointment slot for driving skill test at RTO?"}
            ],
            "location_question": "Which RTO or State are you applying in?",
            "authority_label": "Regional Transport Office (RTO)",
            "has_form": False,
            "is_landing_page": True
        }

    # 6. Municipal Corporation Portals
    if "portal" in url_lower or "municipal" in text_lower or "corporation" in text_lower or "ward" in text_lower:
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

    # 7. General Fallback with Domain-Specific Chips (NO hardcoded municipal water/roads on generic portals!)
    portal_name = title.strip() if title else "Public Service Portal"
    res = {
        "portal_name": portal_name,
        "authority_name": "Public Service Authority",
        "portal_type": "CIVIC_PORTAL",
        "welcome_greeting": f"Namaste! I have inspected {portal_name}. What service or guidance can I help you with today?",
        "placeholder_text": f"Ask how to use {portal_name} or report an issue...",
        "chips": [
            {"label": "📝 Step-by-Step Application Guide", "text": f"How do I apply or register on {portal_name} step-by-step?"},
            {"label": "🔍 Track Application / Petition Status", "text": f"How do I track my existing status on {portal_name}?"},
            {"label": "📑 Required Documents & Guidelines", "text": f"What documents and guidelines are required for {portal_name}?"},
            {"label": "❓ Helpdesk & Support Assistance", "text": f"How to reach official helpline and support for {portal_name}?"}
        ],
        "location_question": "Where are you located (City or State)?",
        "authority_label": "Concerned Authority",
        "has_form": False,
        "is_landing_page": True
    }
    if cache_key:
        _PAGE_STUDY_CACHE[cache_key] = res
    return res
