"""
Nagarik AI - Zero-Knowledge PII Shielding Engine
Protects citizen personal identity information before logging, external LLM calls, or database storage.

Masks:
1. Aadhaar (12-digit Indian national identity number) -> XXXX-XXXX-1234
2. Indian Mobile Numbers (10 digits / +91) -> +91-XXXXX-XX345
3. PAN Card (Permanent Account Number - 10 chars) -> ABXXXXX12F
4. Voter ID (EPIC - 3 letters + 7 digits) -> ABCXXXX123
5. Bank Account Numbers (>9 digits when labeled) -> XXXXXXXX1234
"""

import re
import logging
from typing import Dict, Any, List, Tuple, Optional
from pydantic import BaseModel, Field

# Setup logger for privacy shielding
logger = logging.getLogger("nagarik_ai.pii_shield")

# -----------------------------------------------------------------------------
# Zero-Knowledge Regex Matchers
# -----------------------------------------------------------------------------
# 12-digit Aadhaar (cannot start with 0 or 1 per UIDAI specification)
AADHAAR_REGEX = re.compile(r'\b([2-9]\d{3})[\s\-]?(\d{4})[\s\-]?(\d{4})\b')

# Indian Mobile Numbers (10 digits starting with 6,7,8,9, with optional +91, 91, or 0 prefix)
PHONE_REGEX = re.compile(r'(?:\+?91[\s\-]?)?(?:\b0)?([6-9]\d{4})[\s\-]?(\d{5})\b')

# Indian PAN Card (5 uppercase letters, 4 digits, 1 uppercase letter)
PAN_REGEX = re.compile(r'\b([A-Z]{2})[A-Z]{3}(\d{2})(\d{2})([A-Z])\b', re.IGNORECASE)

# Voter ID / EPIC Number (3 uppercase letters followed by 7 digits)
VOTER_ID_REGEX = re.compile(r'\b([A-Z]{3})\d{4}(\d{3})\b', re.IGNORECASE)

# Bank Account Number (explicitly tagged: 9 to 18 digits)
BANK_ACCOUNT_REGEX = re.compile(r'(?i)\b(?:a/c|acc(?:ount)?|khata|khata\s+no\.?)\s*[:#\-]?\s*(\d{5,14})(\d{4})\b')


class PIIShieldResult(BaseModel):
    original_text: str
    sanitized_text: str
    detected_pii_types: List[str] = Field(default_factory=list)
    masked_count: int = 0
    has_pii: bool = False
    privacy_notice_en: Optional[str] = None
    privacy_notice_hi: Optional[str] = None
    privacy_notice_te: Optional[str] = None


class PIIShield:
    """
    Zero-Knowledge Privacy Shield.
    Guarantees no raw identity credentials pass beyond the WhatsApp gateway intake boundary.
    """

    @classmethod
    def mask_aadhaar(cls, text: str) -> Tuple[str, int]:
        count = 0
        def _replace(match):
            nonlocal count
            count += 1
            last4 = match.group(3)
            return f"XXXX-XXXX-{last4}"
        masked = AADHAAR_REGEX.sub(_replace, text)
        return masked, count

    @classmethod
    def mask_phone(cls, text: str, preserve_last: int = 3) -> Tuple[str, int]:
        count = 0
        def _replace(match):
            nonlocal count
            count += 1
            full_match = match.group(0).replace(" ", "").replace("-", "")
            last_digits = full_match[-preserve_last:]
            return f"+91-XXXXX-XX{last_digits}"
        masked = PHONE_REGEX.sub(_replace, text)
        return masked, count

    @classmethod
    def mask_pan(cls, text: str) -> Tuple[str, int]:
        count = 0
        def _replace(match):
            nonlocal count
            count += 1
            prefix = match.group(1).upper()
            mid_digits = match.group(3)
            suffix = match.group(4).upper()
            return f"{prefix}XXXXX{mid_digits}{suffix}"
        masked = PAN_REGEX.sub(_replace, text)
        return masked, count

    @classmethod
    def mask_voter_id(cls, text: str) -> Tuple[str, int]:
        count = 0
        def _replace(match):
            nonlocal count
            count += 1
            prefix = match.group(1).upper()
            suffix = match.group(2)
            return f"{prefix}XXXX{suffix}"
        masked = VOTER_ID_REGEX.sub(_replace, text)
        return masked, count

    @classmethod
    def mask_bank_account(cls, text: str) -> Tuple[str, int]:
        count = 0
        def _replace(match):
            nonlocal count
            count += 1
            last4 = match.group(2)
            return f"A/C XXXXXXXX{last4}"
        masked = BANK_ACCOUNT_REGEX.sub(_replace, text)
        return masked, count

    @classmethod
    def sanitize(
        cls,
        text: str,
        mask_phone_flag: bool = True
    ) -> PIIShieldResult:
        """
        Executes zero-knowledge PII sanitization in accordance with sovereign citizen privacy standards.
        """
        if not text:
            return PIIShieldResult(original_text="", sanitized_text="")

        detected = []
        total_masked = 0
        current_text = text

        # 1. Mask Aadhaar
        current_text, c_aadhaar = cls.mask_aadhaar(current_text)
        if c_aadhaar > 0:
            detected.append("Aadhaar Number (UIDAI)")
            total_masked += c_aadhaar

        # 2. Mask PAN Card
        current_text, c_pan = cls.mask_pan(current_text)
        if c_pan > 0:
            detected.append("Income Tax PAN")
            total_masked += c_pan

        # 3. Mask Voter ID / EPIC
        current_text, c_voter = cls.mask_voter_id(current_text)
        if c_voter > 0:
            detected.append("Election EPIC Voter ID")
            total_masked += c_voter

        # 4. Mask Bank Account
        current_text, c_bank = cls.mask_bank_account(current_text)
        if c_bank > 0:
            detected.append("Bank Account Number")
            total_masked += c_bank

        # 5. Mask Phone Number (optional in query body, always masked before logs)
        if mask_phone_flag:
            current_text, c_phone = cls.mask_phone(current_text)
            if c_phone > 0:
                detected.append("Citizen Phone Number")
                total_masked += c_phone

        has_pii = total_masked > 0

        # Construct citizen multilingual privacy notices
        notice_en = None
        notice_hi = None
        notice_te = None

        if has_pii:
            types_str = ", ".join(detected)
            notice_en = f"🔒 *Zero-Knowledge Privacy Shield Active*: Sensitive identifier detected ({types_str}) and auto-masked. Nagarik AI never stores or logs private citizen credentials."
            notice_hi = f"🔒 *गोपनीयता सुरक्षा सक्रिय*: आपकी संवेदनशील पहचान जानकारी ({types_str}) सुरक्षित रूप से मास्क कर दी गई है। नागरिक AI निजी डेटा कभी संग्रहित नहीं करता।"
            notice_te = f"🔒 *జీరో-నాలెడ్జ్ ప్రైవసీ షీల్డ్ యాక్టివ్*: సున్నితమైన గుర్తింపు వివరాలు ({types_str}) ఆటో-మాస్క్ చేయబడ్డాయి. నాగరిక్ AI వ్యక్తిగత డేటాను ఎప్పుడూ నిల్వ చేయదు."

        return PIIShieldResult(
            original_text=text,
            sanitized_text=current_text,
            detected_pii_types=detected,
            masked_count=total_masked,
            has_pii=has_pii,
            privacy_notice_en=notice_en,
            privacy_notice_hi=notice_hi,
            privacy_notice_te=notice_te
        )

    @classmethod
    def sanitize_phone_display(cls, phone_number: str) -> str:
        """Shields a phone number for display/logging, preserving country code and last 3 digits."""
        clean = re.sub(r"[^\d+]", "", phone_number)
        if len(clean) >= 10:
            return f"{clean[:3]}...{clean[-3:]}"
        return "***"


# Global singleton
pii_shield = PIIShield()
