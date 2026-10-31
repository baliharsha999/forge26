"""
Query Normalization Agent for Indian languages, Romanized queries, and code-mixed inputs.
Handles spelling mistakes, informal expressions, abbreviations, and converts Romanized
text to native Indic script and English retrieval interpretations while preserving intent.
"""

import json
import logging
import unicodedata
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from app.config.settings import get_settings
from app.agents.language_agent import LanguageAgent, LanguageDetectionResult

logger = logging.getLogger(__name__)


class QueryNormalizationResult(BaseModel):
    """Pydantic model for normalized query interpretations."""
    original_query: str = Field(..., description="Original user input query")
    normalized_native_query: str = Field(..., description="Normalized query in native script if non-English, or clean English")
    english_retrieval_query: str = Field(..., description="English interpretation optimized for semantic retrieval")
    detected_language: str = Field(default="English", description="Identified language")
    language_code: str = Field(default="en", description="ISO 639-1 code")
    is_code_mixed: bool = Field(default=False, description="True if input mixes English and Indic words")

    @property
    def normalized_query(self) -> str:
        return self.normalized_native_query or self.english_retrieval_query or self.original_query


class QueryNormalizationAgent:
    """Agent responsible for normalizing informal, Romanized, or code-mixed Indic queries."""

    ABBREVIATIONS = {
        r"\bgovt\b": "government",
        r"\bdoc\b": "document",
        r"\bdocs\b": "documents",
        r"\bsch\b": "scholarship",
        r"\bpm\b": "pradhan mantri",
        r"\bappl\b": "application",
        r"\breq\b": "required",
        r"\binfo\b": "information",
        r"\byr\b": "year",
        r"\brs\b": "rupees",
    }

    # Pre-computed rule mappings for common Romanized queries
    COMMON_ROMANIZED_MAP = {
        "mujhe students ke liye govt scholarship batao": (
            "मुझे छात्रों के लिए सरकारी छात्रवृत्ति बताओ",
            "Government scholarships available for students in India."
        ),
        "pm kisan ke paise kab aayenge": (
            "पीएम किसान के पैसे कब आएंगे",
            "PM-KISAN installment disbursement date and payment schedule."
        ),
        "kisan credit card kaise banaye": (
            "किसान क्रेडिट कार्ड कैसे बनाएं",
            "How to apply for Kisan Credit Card eligibility and process."
        ),
        "naaku vidyarthulaku scholarship kavali": (
            "నాకు విద్యార్థులకు స్కాలర్‌షిప్ కావాలి",
            "Government scholarships and educational financial assistance for students."
        ),
    }

    def __init__(self):
        self.settings = get_settings()
        self.language_agent = LanguageAgent()
        self._groq_client = None

    @property
    def client(self):
        if self._groq_client is None and self.settings.GROQ_API_KEY:
            try:
                from groq import Groq
                self._groq_client = Groq(api_key=self.settings.GROQ_API_KEY)
            except Exception as e:
                logger.warning(f"Could not initialize Groq client for normalization: {e}")
        return self._groq_client

    def normalize(
        self,
        query: str,
        lang_detection: Optional[Any] = None,
        detected_language: Optional[str] = None,
        detected_script: Optional[str] = None
    ) -> QueryNormalizationResult:
        """
        Normalizes informal, Romanized, or code-mixed query into native script and English.
        """
        raw_query = query.strip()
        if not raw_query:
            return QueryNormalizationResult(
                original_query="",
                normalized_native_query="",
                english_retrieval_query="",
                detected_language="English",
                language_code="en"
            )

        # Handle positional string arguments
        if isinstance(lang_detection, str):
            detected_language = lang_detection
            lang_detection = None

        # Detect language if not provided
        if not lang_detection:
            lang_detection = self.language_agent.detect(raw_query)

        detected_lang = detected_language or lang_detection.detected_language
        lang_code = lang_detection.language_code
        script = detected_script or lang_detection.script

        # 1. Check exact dictionary of common Romanized phrases
        clean_lower = raw_query.lower()
        if clean_lower in self.COMMON_ROMANIZED_MAP:
            native_q, eng_q = self.COMMON_ROMANIZED_MAP[clean_lower]
            return QueryNormalizationResult(
                original_query=raw_query,
                normalized_native_query=native_q,
                english_retrieval_query=eng_q,
                detected_language=detected_lang,
                language_code=lang_code,
                is_code_mixed=True
            )

        # 2. Pure English queries
        if detected_lang == "English" and script == "Latin":
            expanded = unicodedata.normalize("NFC", raw_query)
            for pattern, repl in self.ABBREVIATIONS.items():
                import re
                expanded = re.sub(pattern, repl, expanded, flags=re.IGNORECASE)
            return QueryNormalizationResult(
                original_query=raw_query,
                normalized_native_query=expanded,
                english_retrieval_query=expanded,
                detected_language="English",
                language_code="en",
                is_code_mixed=False
            )

        # 3. For Romanized Indic or Native Script queries, attempt LLM normalization
        llm_res = self._llm_normalize(raw_query, detected_lang, script)
        if llm_res:
            return llm_res

        # 4. Fallback heuristic normalization
        return self._heuristic_normalize(raw_query, detected_lang, lang_code, script)

    def _llm_normalize(
        self,
        query: str,
        detected_lang: str,
        script: str
    ) -> Optional[QueryNormalizationResult]:
        """Uses LLM to accurately normalize regional Romanized and code-mixed inputs."""
        if not self.client:
            return None

        prompt = f"""You are an expert in Indian languages, Romanized transliteration (Hinglish, Tenglish, Tanglish), and government scheme terminology.

User Input Query: "{query}"
Detected Primary Language: {detected_lang}
Detected Script: {script}

Your tasks:
1. Handle any informal language, regional slang, or spelling errors.
2. If the user used Romanized text (e.g., Hinglish or Tenglish), convert it into the proper native script (e.g. Devanagari for Hindi, Telugu script for Telugu).
3. Translate or formulate an accurate, clear English retrieval query that preserves all named entities, scheme names, figures, and government intent.
4. Preserve the user's exact informational intent without hallucinating.

Output strictly valid JSON:
{{
  "normalized_native_query": "<normalized query in native script or clean English>",
  "english_retrieval_query": "<clear English search query for government documents>",
  "is_code_mixed": true or false
}}
"""
        models = [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL]
        for model in models:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You output only strictly valid JSON matching the requested schema."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    response_format={"type": "json_object"},
                    timeout=15.0
                )
                data = json.loads(response.choices[0].message.content.strip())
                native_q = data.get("normalized_native_query", query)
                eng_q = data.get("english_retrieval_query", query)
                is_mixed = data.get("is_code_mixed", False)

                return QueryNormalizationResult(
                    original_query=query,
                    normalized_native_query=native_q,
                    english_retrieval_query=eng_q,
                    detected_language=detected_lang,
                    language_code=LanguageAgent.SCRIPT_TO_DEFAULT_LANG.get(script, (detected_lang, "hi"))[1] if script != "Latin" else "hi",
                    is_code_mixed=is_mixed
                )
            except Exception as e:
                logger.warning(f"Groq normalization failed with {model}: {e}")

        return None

    def _heuristic_normalize(
        self,
        query: str,
        detected_lang: str,
        lang_code: str,
        script: str
    ) -> QueryNormalizationResult:
        """Rule-based fallback when LLM is unavailable."""
        normalized = unicodedata.normalize("NFC", query)

        # Expand common English abbreviations
        clean_eng = normalized
        for pattern, repl in self.ABBREVIATIONS.items():
            import re
            clean_eng = re.sub(pattern, repl, clean_eng, flags=re.IGNORECASE)

        # If Romanized text, map prominent words
        if script == "Latin":
            # Default native representation retains text or provides generic native scheme query
            return QueryNormalizationResult(
                original_query=query,
                normalized_native_query=clean_eng,
                english_retrieval_query=clean_eng,
                detected_language=detected_lang,
                language_code=lang_code,
                is_code_mixed=True
            )

        # Native script query
        return QueryNormalizationResult(
            original_query=query,
            normalized_native_query=normalized,
            english_retrieval_query=clean_eng,
            detected_language=detected_lang,
            language_code=lang_code,
            is_code_mixed=False
        )
