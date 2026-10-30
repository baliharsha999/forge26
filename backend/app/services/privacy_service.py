import re
from typing import Tuple, Optional

# Indian Aadhaar regex (12 digits, cannot start with 0 or 1)
AADHAAR_REGEX = re.compile(r'\b[2-9]\d{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b')

# Indian PAN card regex
PAN_REGEX = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b')

def inspect_and_sanitize_pii(text: str) -> Tuple[str, Optional[str]]:
    """
    Scans text for sensitive citizen identifiers (Aadhaar, PAN).
    Returns (sanitized_text, warning_message).
    In accordance with JanSetu Lite safety rules, Aadhaar is NEVER stored.
    """
    warning = None
    sanitized = text

    if AADHAAR_REGEX.search(text):
        warning = "⚠️ Privacy Advisory: A 12-digit Aadhaar number was detected in your input. For your security, JanSetu Lite does NOT store government identity numbers and has masked it."
        # Mask Aadhaar
        def mask_aadhaar(match):
            m = match.group(0).replace(" ", "").replace("-", "")
            return f"XXXX-XXXX-{m[-4:]}"
        sanitized = AADHAAR_REGEX.sub(mask_aadhaar, sanitized)

    if PAN_REGEX.search(sanitized):
        pan_warn = "⚠️ Privacy Advisory: PAN Card details detected and masked."
        warning = f"{warning} | {pan_warn}" if warning else pan_warn
        def mask_pan(match):
            m = match.group(0)
            return f"{m[:2]}XXXXX{m[-2:]}"
        sanitized = PAN_REGEX.sub(mask_pan, sanitized)

    return sanitized, warning
