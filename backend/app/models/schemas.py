from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class CitizenInfo(BaseModel):
    name: str = Field(..., description="Citizen's full name")
    phone: str = Field(..., description="Contact phone or WhatsApp number")
    state: str = Field("Telangana", description="State of the citizen")
    district: str = Field("Hyderabad", description="District or Municipal Zone")
    locality: str = Field("", description="Ward / Village / Locality")

class GrievanceAnalysisRequest(BaseModel):
    raw_input: str = Field(..., description="User's voice transcript or text in any language")
    language: Optional[str] = Field("en", description="Detected or selected language")
    image_base64: Optional[str] = Field(None, description="Optional base64 encoded photo proof")
    location: Optional[str] = Field(None, description="Extracted or GPS location string")

class GrievanceAnalysisResult(BaseModel):
    department: str
    category: str
    urgency_level: str  # HIGH, MEDIUM, LOW
    urgency_score: int  # 1-10
    standardized_english_summary: str
    original_language: str
    extracted_location: str
    actionable_remedy: str
    applicable_act_or_regulation: str
    tags: List[str]

class GrievanceSubmissionRequest(BaseModel):
    citizen: CitizenInfo
    department: str
    category: str
    urgency_level: str
    title: str
    description: str
    location: str
    image_url: Optional[str] = None

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

class FactCheckRequest(BaseModel):
    claim: str = Field(..., description="The viral news, forward, or policy claim to verify")
    source: Optional[str] = Field("WhatsApp Forward", description="Source of the claim")
    language: Optional[str] = Field("auto", description="Language of the claim")

class FactCheckResult(BaseModel):
    claim: str
    verdict: str  # BOGUS, MISLEADING, VERIFIED, UNVERIFIED
    truth_score: int  # 0 to 100
    summary: str
    key_findings: List[str]
    official_source_citation: str
    gazette_or_pib_reference: str
    action_advice_for_citizens: str
    verified_at: str

class SchemeSearchRequest(BaseModel):
    category: Optional[str] = Field("all", description="farmer, student, women, healthcare, senior, msme")
    income_level: Optional[str] = Field(None, description="Annual income range")
    state: Optional[str] = Field("All-India", description="State filter")
    search_query: Optional[str] = Field("", description="Keyword search")

class GovernmentScheme(BaseModel):
    id: str
    title: str
    ministry: str
    target_beneficiary: str
    financial_benefit: str
    eligibility_criteria: List[str]
    documents_required: List[str]
    official_portal_url: str
    category: str
    state: str
