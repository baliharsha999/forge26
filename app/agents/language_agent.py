"""
Language Detection and Script Identification Agent.
Identifies query language, ISO 639-1 code, native script vs Romanized text,
code-switching, and preferred response language without relying entirely on LLMs.
"""

import re
import unicodedata
from typing import Dict, Any, Tuple, Optional
from pydantic import BaseModel, Field

try:
    import langdetect
    from langdetect import DetectorFactory
    DetectorFactory.seed = 0
    HAS_LANGDETECT = True
except ImportError:
    HAS_LANGDETECT = False


class LanguageDetectionResult(BaseModel):
    """Structured output for language and script detection."""
    detected_language: str = Field(..., description="Full language name (e.g. Hindi, Telugu, English)")
    language_code: str = Field(..., description="ISO 639-1 language code (e.g. hi, te, en)")
    script: str = Field(..., description="Script name (e.g. Devanagari, Telugu, Tamil, Latin)")
    is_mixed_language: bool = Field(default=False, description="True if query contains multiple languages or scripts")
    response_language: str = Field(..., description="Preferred response language")
    confidence: float = Field(default=0.95, description="Confidence score between 0.0 and 1.0")


class LanguageAgent:
    """Agent for high-accuracy Indic and English language/script detection."""

    SCRIPT_RANGES = {
        "Devanagari": (0x0900, 0x097F),
        "Bengali": (0x0980, 0x09FF),
        "Gurmukhi": (0x0A00, 0x0A7F),
        "Gujarati": (0x0A80, 0x0AFF),
        "Odia": (0x0B00, 0x0B7F),
        "Tamil": (0x0B80, 0x0BFF),
        "Telugu": (0x0C00, 0x0C7F),
        "Kannada": (0x0C80, 0x0CFF),
        "Malayalam": (0x0D00, 0x0D7F),
        "Urdu": (0x0600, 0x06FF),
    }

    SCRIPT_TO_DEFAULT_LANG = {
        "Telugu": ("Telugu", "te"),
        "Tamil": ("Tamil", "ta"),
        "Bengali": ("Bengali", "bn"),
        "Kannada": ("Kannada", "kn"),
        "Malayalam": ("Malayalam", "ml"),
        "Gujarati": ("Gujarati", "gu"),
        "Gurmukhi": ("Punjabi", "pa"),
        "Odia": ("Odia", "or"),
        "Urdu": ("Urdu", "ur"),
    }

    # Romanized markers (distinctive functional / grammar words)
    ROMAN_HINDI_FUNCTIONAL = {
        "mujhe", "batao", "chahiye", "kaise", "milega", "kya", "sarkari",
        "paisa", "paise", "padhai", "chhatravritti", "chhatravriti", "labh",
        "shasan", "hai", "hain", "liye", "karen", "aavedan", "karo", "bataye",
        "yojano", "sahayata", "rashan", "bataiye", "dijiye", "kare"
    }

    ROMAN_TELUGU_FUNCTIONAL = {
        "naaku", "cheppandi", "entha", "unnayi", "dabbulu", "padhakam", "pathakam",
        "yuvatha", "vidyarthulaku", "raitulaku", "rythulaku", "kosam", "evariki",
        "vastundi", "vasthundi", "cheyali", "cheyandi", "ela", "sahayam", "lo", "emiti",
        "enti", "eenti", "gurinchi", "kavali", "undi", "undhi"
    }

    ROMAN_TAMIL_FUNCTIONAL = {
        "enakku", "sollunga", "thittam", "evvalavu", "panam", "arasu", "manavargal",
        "vivasayigal", "pathivu", "seyvathu", "eppadi", "thittangal"
    }

    ENGLISH_FUNCTIONAL = {
        "what", "which", "where", "when", "who", "whom", "whose", "why", "how",
        "is", "are", "was", "were", "the", "about", "for", "under", "benefits",
        "eligibility", "criteria", "scheme", "schemes", "government", "assistance"
    }


    def detect(self, text: str) -> LanguageDetectionResult:
        """
        Identifies language, script, code-mixing, and response language.
        """
        clean_text = text.strip()
        if not clean_text:
            return LanguageDetectionResult(
                detected_language="English",
                language_code="en",
                script="Latin",
                is_mixed_language=False,
                response_language="English",
                confidence=1.0
            )

        # Count characters per script
        script_counts: Dict[str, int] = {k: 0 for k in self.SCRIPT_RANGES}
        script_counts["Latin"] = 0
        script_counts["Other"] = 0

        for char in clean_text:
            code = ord(char)
            matched = False
            for s_name, (low, high) in self.SCRIPT_RANGES.items():
                if low <= code <= high:
                    script_counts[s_name] += 1
                    matched = True
                    break
            if not matched:
                if (0x0041 <= code <= 0x005A) or (0x0061 <= code <= 0x007A):
                    script_counts["Latin"] += 1
                elif not unicodedata.category(char).startswith("P") and not char.isspace():
                    script_counts["Other"] += 1

        total_indic = sum(count for s, count in script_counts.items() if s not in ("Latin", "Other"))
        total_latin = script_counts["Latin"]

        # Case A: Strong Indic script presence
        if total_indic > 0:
            top_script = max(self.SCRIPT_RANGES.keys(), key=lambda s: script_counts[s])
            is_mixed = total_latin > 3  # Contains both Indic script and Latin words

            if top_script == "Devanagari":
                # Disambiguate Hindi vs Marathi
                lang_name, lang_code = self._disambiguate_devanagari(clean_text)
                return LanguageDetectionResult(
                    detected_language=lang_name,
                    language_code=lang_code,
                    script="Devanagari",
                    is_mixed_language=is_mixed,
                    response_language=lang_name,
                    confidence=0.98
                )

            elif top_script == "Bengali":
                # Check for Assamese unique letters: ৰ (U+09F0), ৱ (U+09F1)
                is_assamese = "ৰ" in clean_text or "ৱ" in clean_text
                lang_name = "Assamese" if is_assamese else "Bengali"
                lang_code = "as" if is_assamese else "bn"
                return LanguageDetectionResult(
                    detected_language=lang_name,
                    language_code=lang_code,
                    script="Bengali" if not is_assamese else "Assamese",
                    is_mixed_language=is_mixed,
                    response_language=lang_name,
                    confidence=0.98
                )

            else:
                lang_name, lang_code = self.SCRIPT_TO_DEFAULT_LANG.get(top_script, ("Hindi", "hi"))
                return LanguageDetectionResult(
                    detected_language=lang_name,
                    language_code=lang_code,
                    script=top_script,
                    is_mixed_language=is_mixed,
                    response_language=lang_name,
                    confidence=0.98
                )

        # Case B: Primarily Latin script (Check Romanized Indic vs English)
        words = [w.lower().strip("?,.:;!\"'()[]{}") for w in clean_text.split()]
        word_set = set(words)
        english_matches = word_set.intersection(self.ENGLISH_FUNCTIONAL)

        # Check Romanized Hindi
        hindi_matches = word_set.intersection(self.ROMAN_HINDI_FUNCTIONAL)
        if len(hindi_matches) >= 1 and (len(hindi_matches) >= len(english_matches) or any(m in {"mujhe", "batao", "chahiye", "kaise", "milega", "kya", "sarkari", "chhatravritti"} for m in hindi_matches)):
            is_mixed = len(english_matches) > 0 or any(w in word_set for w in ["scheme", "students", "govt", "scholarship", "apply", "online"])
            return LanguageDetectionResult(
                detected_language="Hindi",
                language_code="hi",
                script="Latin",
                is_mixed_language=is_mixed,
                response_language="Hindi",
                confidence=0.92
            )

        # Check Romanized Telugu
        telugu_matches = word_set.intersection(self.ROMAN_TELUGU_FUNCTIONAL)
        if len(telugu_matches) >= 1:
            is_mixed = len(english_matches) > 0 or any(w in word_set for w in ["scheme", "eligibility", "criteria", "benefits", "apply", "online"])
            return LanguageDetectionResult(
                detected_language="Telugu",
                language_code="te",
                script="Latin",
                is_mixed_language=is_mixed,
                response_language="Telugu",
                confidence=0.92
            )

        # Check Romanized Tamil
        tamil_matches = word_set.intersection(self.ROMAN_TAMIL_FUNCTIONAL)
        if len(tamil_matches) >= 1 and (len(tamil_matches) >= len(english_matches) or any(m in {"enakku", "sollunga", "thittam", "evvalavu"} for m in tamil_matches)):
            return LanguageDetectionResult(
                detected_language="Tamil",
                language_code="ta",
                script="Latin",
                is_mixed_language=len(english_matches) > 0,
                response_language="Tamil",
                confidence=0.92
            )

        # Fallback to langdetect if available
        if HAS_LANGDETECT and len(clean_text) > 10:
            try:
                ld = langdetect.detect(clean_text)
                if ld != "en":
                    code_to_name = {
                        "hi": ("Hindi", "Devanagari"),
                        "te": ("Telugu", "Telugu"),
                        "ta": ("Tamil", "Tamil"),
                        "bn": ("Bengali", "Bengali"),
                        "mr": ("Marathi", "Devanagari"),
                        "gu": ("Gujarati", "Gujarati"),
                        "kn": ("Kannada", "Kannada"),
                        "ml": ("Malayalam", "Malayalam"),
                        "pa": ("Punjabi", "Gurmukhi"),
                        "ur": ("Urdu", "Arabic"),
                    }
                    if ld in code_to_name:
                        name, script = code_to_name[ld]
                        return LanguageDetectionResult(
                            detected_language=name,
                            language_code=ld,
                            script=script,
                            is_mixed_language=False,
                            response_language=name,
                            confidence=0.88
                        )
            except Exception:
                pass

        # Default to English
        return LanguageDetectionResult(
            detected_language="English",
            language_code="en",
            script="Latin",
            is_mixed_language=False,
            response_language="English",
            confidence=0.99
        )

    def _disambiguate_devanagari(self, text: str) -> Tuple[str, str]:
        """Disambiguates between Hindi and Marathi in Devanagari script."""
        marathi_markers = {"आहे", "नाही", "आणि", "या", "करावे", "मिळेल", "योजनांची", "माहिती", "द्या", "काय"}
        words = set(text.split())
        if words.intersection(marathi_markers):
            return "Marathi", "mr"

        if HAS_LANGDETECT:
            try:
                ld = langdetect.detect(text)
                if ld == "mr":
                    return "Marathi", "mr"
            except Exception:
                pass

        return "Hindi", "hi"
