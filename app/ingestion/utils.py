import re, hashlib

def normalize_text(text: str) -> str:
    """Normalize raw extracted text for stable hashing.
    - Remove any remaining HTML tags
    - Collapse whitespace
    - Lower‑case
    """
    # Strip HTML tags if present
    clean = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace and strip
    clean = re.sub(r"\s+", " ", clean).strip().lower()
    return clean

def hash_content(text: str) -> str:
    """Return SHA‑256 hash of normalized text."""
    normalized = normalize_text(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
