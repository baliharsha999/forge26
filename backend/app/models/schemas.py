from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

class CitizenInfo(BaseModel):
    name: str = Field("Ananya Rao", description="Citizen's full name (optional in hero flow)")
    phone: str = Field("9876543210", description="Contact phone or WhatsApp number (optional)")
    state: str = Field("Telangana", description="State of the citizen")
    district: str = Field("Hyderabad", description="District or Municipal Zone")
    locality: str = Field("", description="Ward / Village / Locality")

class GrievanceAnalysisRequest(BaseModel):
    raw_input: str = Field(..., description="User's voice transcript or text in any language")
    language: Optional[str] = Field("en", description="Detected or selected language (en, hi, te)")
    image_base64: Optional[str] = Field(None, description="Optional photo proof")
    location: Optional[str] = Field(None, description="Extracted or GPS location string")
    portal_context: Optional[str] = Field(None, description="Active portal name e.g. CPGRAMS")

class ConfidenceScore(BaseModel):
    category: float = Field(0.95, ge=0.0, le=1.0)
    department: float = Field(0.92, ge=0.0, le=1.0)
    location: float = Field(0.88, ge=0.0, le=1.0)

class GrievanceAnalysisResult(BaseModel):
    category: str
    department: str
    urgency_level: Literal["LOW", "MEDIUM", "HIGH"]
    urgency_score: int
    location_text: str
    description: str
    language: str
    missing_fields: List[str] = Field(default_factory=list)
    confidence: ConfidenceScore = Field(default_factory=ConfidenceScore)
    follow_up_prompt: Optional[str] = None
    actionable_remedy: str
    applicable_act_or_regulation: str
    privacy_warning: Optional[str] = None

class GrievanceSubmissionRequest(BaseModel):
    citizen: CitizenInfo
    department: str
    category: str
    urgency_level: str
    title: str
    description: str
    location: str
    image_url: Optional[str] = None
    user_confirmed: bool = Field(True, description="Explicit citizen confirmation required")

class GrievanceSubmissionResult(BaseModel):
    tracking_id: str
    department: str
    status: str
    submitted_at: str
    estimated_sla_days: int
    assigned_officer_designation: str
    portal_status: str
    browser_agent_telemetry: List[str]
    receipt_screenshot: Optional[str] = None
    verification_hash: str

class EscalationRequest(BaseModel):
    tracking_id: str
    escalation_type: Literal["reminder", "appeal", "rti"] = "reminder"
    days_elapsed: int = 15

class EscalationResponse(BaseModel):
    tracking_id: str
    escalation_type: str
    days_overdue: int
    authority_name: str
    subject_line: str
    letter_body: str
    statutory_act_quoted: str
    action_note: str

class FactCheckRequest(BaseModel):
    claim: str = Field(..., description="The viral news, forward, or policy claim to verify")
    source: Optional[str] = Field("WhatsApp Forward", description="Source of the claim")
    language: Optional[str] = Field("auto", description="Language of the claim")

class FactCheckResult(BaseModel):
    claim: str
    outcome: Literal["matches", "contradicts", "unverified"]
    verdict: str  # Human readable label: "Matches Official Source", "Contradicts Official Source", "Couldn't Verify"
    truth_score: int  # 0 to 100
    summary: str
    exact_source_text: str
    official_source_url: str
    last_verified_date: str
    action_advice_for_citizens: str
    matched_scheme_id: Optional[str] = None

class NormalizedScheme(BaseModel):
    id: str
    name: str
    level: str  # "central" | "state"
    state: str  # "All-India" | State Name
    category: str
    benefit: str
    eligibility_criteria: List[str]
    documents_required: List[str]
    how_to_apply: str
    official_url: str
    source_text: str
    last_verified_date: str
    source_provider: str = "local_verified"

# Backwards compatibility alias
GovernmentScheme = NormalizedScheme

class EligibilityCheckRequest(BaseModel):
    occupation: Optional[str] = Field("farmer", description="farmer, student, artisan, senior, entrepreneur")
    annual_income: Optional[int] = Field(180000, description="Annual household income in INR")
    gender: Optional[str] = Field("any", description="female, male, other")
    age: Optional[int] = Field(32, description="Age in years")
    landholder: Optional[bool] = Field(True, description="Owns cultivable land")

class EligibilityCheckResult(BaseModel):
    likely_eligible_schemes: List[Dict[str, Any]]
    disclaimer: str = "Non-definitive evaluation based on user-provided criteria. Always confirm at official portal."

class PortalChip(BaseModel):
    label: str
    text: str

class PageStudyRequest(BaseModel):
    url: str
    title: Optional[str] = ""
    headings: Optional[Any] = ""
    page_text: Optional[str] = ""

class PageStudyResult(BaseModel):
    portal_name: str
    authority_name: str
    portal_type: str
    welcome_greeting: str
    placeholder_text: str
    chips: List[PortalChip]
    location_question: str
    authority_label: str
    has_form: bool
    is_landing_page: bool

