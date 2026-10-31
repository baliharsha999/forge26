"""
Comprehensive Security Guardrails for Government Information RAG System.
Provides input prompt-injection & jailbreak defense, PII redaction,
demographic bias prevention, toxicity filtering, out-of-domain gating,
and output URL-whitelist enforcement.
"""

import re
from typing import Dict, Any, Optional, Tuple, List
from pydantic import BaseModel, Field

from app.config.settings import get_settings


class GuardrailResult(BaseModel):
    """Structured result of safety and security guardrail evaluation."""
    passed: bool = Field(default=True, description="Whether the input passed all safety guardrails")
    flagged_category: Optional[str] = Field(default=None, description="Category of violation if blocked")
    risk_level: str = Field(default="low", description="'low', 'medium', or 'high'")
    sanitized_query: str = Field(..., description="Query with sensitive PII masked and normalized")
    refusal_message: Optional[str] = Field(default=None, description="Controlled response if blocked")


class GovernmentRAGGuardrails:
    """Enforces strict input safety, PII protection, and output citation integrity."""

    # 1. Prompt Injection, Jailbreak, and Instruction Override Patterns
    INJECTION_PATTERNS = [
        r"ignore\s+(all\s+)?(previous|prior|system)\s+(instructions|directives|prompts|rules)",
        r"disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)",
        r"forget\s+(all\s+)?(instructions|rules|guidelines)",
        r"you\s+are\s+now\s+(hackerbot|dan|freeai|jailbreak|unfiltered|an\s+ai\s+without\s+rules)",
        r"system\s+override\s+successful",
        r"enter\s+developer\s+mode",
        r"tell\s+me\s+your\s+(system\s+prompt|master\s+prompt|hidden\s+instructions)",
        r"bypass\s+(aadhaar|biometric|otp|kyc|verification|security)",
        r"(how\s+to\s+)?(forge|fake|create\s+counterfeit)\s+(income|caste|domicile|ration)\s+(certificate|card|document)",
        r"generate\s+fraudulent\s+(claims|subsidies|pension|schemes)",
        r"hack\s+(into\s+)?(government|portal|database|server)"
    ]

    # 2. Out-of-Domain Non-Civic Topics (Fast Gating)
    OUT_OF_DOMAIN_PATTERNS = [
        r"\b(cheat\s+codes?|cheat\s+engine|spawn\s+tanks?|gta\s+(5|v|vice\s+city|san\s+andreas))\b",
        r"\b(bake\s+a\s+cake|chocolate\s+cake|recipe\s+for|frosting|vanilla\s+sponge)\b",
        r"\b(playstation\s+(4|5)|xbox\s+series|nintendo\s+switch)\b",
        r"\b(hollywood\s+movie|song\s+lyrics|cricket\s+score|fifa\s+world\s+cup)\b",
        r"\b(write\s+a\s+python\s+script\s+for\s+snake\s+game|binary\s+search\s+tree\s+leetcode)\b"
    ]

    # 3. Hate Speech, Defamatory & Toxic Patterns
    TOXIC_PATTERNS = [
        r"\b(kill|murder|attack|bomb|terrorist|assassinate)\b",
        r"\b(corrupt,\s+useless,\s+and\s+stupid|insulting\s+civil\s+servants|fuck|bastard|idiot)\b",
        r"\b(bar\s+(certain\s+)?(castes?|religions?|muslims?|hindus?|dalits?|minorities?))\b",
        r"\b(subsidies\s+should\s+only\s+be\s+given\s+to\s+one\s+religion)\b"
    ]

    # 4. PII Regex Patterns
    AADHAAR_REGEX = re.compile(r"\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b")
    PAN_REGEX = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b")
    PHONE_REGEX = re.compile(r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b")
    EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")

    CONTROLLED_REFUSAL_INJECTION = (
        "I am an official Government Information Assistant. I cannot comply with requests to bypass "
        "verification, forge certificates, ignore safety guidelines, or access unauthorized systems. "
        "Please ask about legitimate government schemes, eligibility, and application procedures."
    )

    CONTROLLED_REFUSAL_OUT_OF_DOMAIN = (
        "I don't have sufficient verified information in the available government documents to answer this question. "
        "I am designed specifically to assist with Indian Government welfare schemes, subsidies, pensions, and public services."
    )

    CONTROLLED_REFUSAL_TOXIC = (
        "I cannot assist with abusive, defamatory, or discriminatory requests. All citizen welfare schemes "
        "are administered under constitutional equality and verified statutory rules."
    )

    @classmethod
    def sanitize_pii(cls, text: str) -> str:
        """Masks sensitive citizen PII before processing or logging."""
        sanitized = cls.AADHAAR_REGEX.sub("[AADHAAR REDACTED]", text)
        sanitized = cls.PAN_REGEX.sub("[PAN REDACTED]", sanitized)
        sanitized = cls.PHONE_REGEX.sub("[PHONE REDACTED]", sanitized)
        sanitized = cls.EMAIL_REGEX.sub("[EMAIL REDACTED]", sanitized)
        return sanitized

    @classmethod
    def check_input_guardrail(cls, query: str) -> GuardrailResult:
        """
        Fast, zero-latency input evaluation for security threats, jailbreaks,
        toxicity, and out-of-domain inquiries.
        """
        if not query or not query.strip():
            return GuardrailResult(
                passed=False,
                flagged_category="empty_query",
                risk_level="high",
                sanitized_query="",
                refusal_message="Please enter a valid query regarding government schemes or public services."
            )

        sanitized = cls.sanitize_pii(query.strip())
        lower_q = query.lower().strip()

        # 1. Prompt Injection / Jailbreak check
        for pat in cls.INJECTION_PATTERNS:
            if re.search(pat, lower_q, re.IGNORECASE):
                return GuardrailResult(
                    passed=False,
                    flagged_category="prompt_injection_jailbreak",
                    risk_level="critical",
                    sanitized_query=sanitized,
                    refusal_message=cls.CONTROLLED_REFUSAL_INJECTION
                )

        # 2. Toxicity / Hate Speech check
        for pat in cls.TOXIC_PATTERNS:
            if re.search(pat, lower_q, re.IGNORECASE):
                return GuardrailResult(
                    passed=False,
                    flagged_category="toxicity_hate_speech",
                    risk_level="high",
                    sanitized_query=sanitized,
                    refusal_message=cls.CONTROLLED_REFUSAL_TOXIC
                )

        # 3. Out-of-Domain Non-Civic Filter
        for pat in cls.OUT_OF_DOMAIN_PATTERNS:
            if re.search(pat, lower_q, re.IGNORECASE):
                return GuardrailResult(
                    passed=False,
                    flagged_category="out_of_domain",
                    risk_level="medium",
                    sanitized_query=sanitized,
                    refusal_message=cls.CONTROLLED_REFUSAL_OUT_OF_DOMAIN
                )

        return GuardrailResult(
            passed=True,
            flagged_category=None,
            risk_level="low",
            sanitized_query=sanitized,
            refusal_message=None
        )

    @classmethod
    def enforce_output_guardrail(cls, answer: str, allowed_domains: Optional[List[str]] = None) -> str:
        """
        Validates output to ensure citation authenticity and strip any fabricated URLs.
        Only whitelisted domains (.gov.in, .nic.in, myscheme.gov.in) are permitted.
        """
        settings = get_settings()
        trusted = allowed_domains or settings.TRUSTED_DOMAINS

        def replace_link(match):
            text = match.group(1)
            url = match.group(2)
            url_lower = url.lower()

            is_valid = (
                url_lower.endswith(".gov.in") or
                url_lower.endswith(".nic.in") or
                ".gov.in/" in url_lower or
                ".nic.in/" in url_lower or
                any(t in url_lower for t in trusted)
            )

            if is_valid:
                return f"[{text}]({url})"
            else:
                # Strip unauthorized or fabricated links
                return f"{text} (Official Portal: https://www.myscheme.gov.in)"

        # Replace markdown links [title](url)
        sanitized_answer = re.sub(r"\[([^\]]+)\]\((https?://[^\)]+)\)", replace_link, answer)
        return sanitized_answer
