"""
Multilingual Query Expansion and Translation Agent.
Generates targeted cross-lingual search queries, alternative native phrasing,
and precise English translations while preserving scheme names, entities, and figures.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.config.settings import get_settings
from app.agents.language_agent import LanguageAgent

logger = logging.getLogger(__name__)


class TranslationResult(BaseModel):
    """Structured Pydantic output for query translation."""
    original_query: str
    translated_query: str
    source_language: str
    target_language: str = "English"
    translation_status: str


class MultilingualQueryExpansionResult(BaseModel):
    """Structured Pydantic output for multilingual query expansion."""
    original_query: str = Field(..., description="Original query in user language")
    translated_english_query: str = Field(..., description="Faithfully translated English query")
    native_variations: List[str] = Field(default_factory=list, description="Alternative phrasing in native language")
    english_variations: List[str] = Field(default_factory=list, description="Targeted English search queries")
    department_terms: List[str] = Field(default_factory=list, description="Official government department search terms")
    keyword_variations: List[str] = Field(default_factory=list, description="Keyword-oriented variations")
    all_search_queries: List[str] = Field(default_factory=list, description="Consolidated deduplicated query list for retrieval")


class MultilingualQueryAgent:
    """Agent responsible for multilingual query translation and retrieval expansion."""

    # Curated cross-lingual dictionaries for Indian Government Schemes
    SCHEME_TRANSLATIONS = {
        "pm kisan": "Pradhan Mantri Kisan Samman Nidhi",
        "pm-kisan": "Pradhan Mantri Kisan Samman Nidhi",
        "పీఎం కిసాన్": "Pradhan Mantri Kisan Samman Nidhi PM-KISAN",
        "पीएम किसान": "Pradhan Mantri Kisan Samman Nidhi PM-KISAN",
        "రైతులకు": "farmers agricultural beneficiaries",
        "किसानों": "farmers agricultural beneficiaries",
        "సబ్సిడీలు": "subsidies financial assistance",
        "सब्सिडी": "subsidies financial assistance",
        "స్కాలర్‌షిప్": "scholarships educational assistance",
        "छात्रवृत्ति": "scholarships educational assistance",
        "పెన్షన్": "pension Atal Pension Yojana APY",
        "पेंशन": "pension Atal Pension Yojana APY",
        "ముద్ర": "Pradhan Mantri Mudra Yojana PMMY business loan",
        "मुद्रा": "Pradhan Mantri Mudra Yojana PMMY business loan",
        "ఆవాస్": "Pradhan Mantri Awas Yojana PMAY housing",
        "आवास": "Pradhan Mantri Awas Yojana PMAY housing",
        "విద్యార్థులకు": "students education benefits",
        "छात्रों": "students education benefits",
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
                logger.warning(f"Groq client init failed in MultilingualQueryAgent: {e}")
        return self._groq_client

    def translate_query(self, query: str, source_language: str = "auto") -> str:
        """
        Translates non-English queries into English for cross-lingual retrieval.
        Preserves scheme names, numbers, departments, and named entities.
        """
        clean_q = query.strip()
        if not clean_q:
            return ""

        if source_language == "auto":
            lang_res = self.language_agent.detect(clean_q)
            source_language = lang_res.detected_language

        if source_language.lower() == "english":
            return clean_q

        # Attempt LLM translation
        if self.client:
            prompt = f"""You are an expert government translator.
Translate the following natural-language citizen query from {source_language} into accurate English.

Rules:
1. Preserve all government scheme names verbatim (e.g. PM-KISAN, PMAY-U, PMMVY, Atal Pension Yojana).
2. Preserve exact numbers, amounts, ages, dates (e.g. 6000, 10000, 18-40 years).
3. Preserve official department or ministry references.
4. Output ONLY the translated English query. No explanations, no markdown formatting.

Input Query: "{clean_q}"
"""
            models = [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL]
            for model in models:
                try:
                    resp = self.client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.0,
                        timeout=12.0
                    )
                    translated = resp.choices[0].message.content.strip().strip('"').strip("'")
                    if translated and len(translated) > 3:
                        return translated
                except Exception as e:
                    logger.warning(f"LLM translation failed with {model}: {e}")

        # Fallback dictionary substitution
        return self._heuristic_translate(clean_q)

    def translate_to_english(self, query: str, source_language: str = "auto") -> TranslationResult:
        """Translates query to English with structured TranslationResult."""
        clean_q = query.strip()
        if source_language == "auto":
            det = self.language_agent.detect(clean_q)
            source_language = det.detected_language

        if source_language.lower() == "english":
            return TranslationResult(
                original_query=clean_q,
                translated_query=clean_q,
                source_language="English",
                target_language="English",
                translation_status="same_language"
            )

        translated = self.translate_query(clean_q, source_language=source_language)
        status = "translated" if translated and translated.strip().lower() != clean_q.lower() else "same_language"
        return TranslationResult(
            original_query=clean_q,
            translated_query=translated or clean_q,
            source_language=source_language,
            target_language="English",
            translation_status=status
        )

    def expand_multilingual(
        self,
        query: str,
        detected_language: str = "auto",
        detected_script: str = "Latin"
    ) -> List[str]:
        """Convenience method returning list of all search queries."""
        res = self.expand_query(original_query=query, source_language=detected_language)
        return res.all_search_queries

    def expand_query(
        self,
        original_query: str,
        normalized_query: Optional[str] = None,
        source_language: str = "auto",
        department: Optional[str] = None
    ) -> MultilingualQueryExpansionResult:
        """
        Generates native phrasing, English retrieval queries, department terms, and keywords.
        """
        active_query = normalized_query or original_query
        if source_language == "auto":
            det = self.language_agent.detect(active_query)
            source_language = det.detected_language

        # Translate to English
        translated_en = self.translate_query(active_query, source_language=source_language)
        if not translated_en or source_language.lower() == "english":
            translated_en = active_query

        # LLM expansion
        if self.client:
            prompt = f"""You are a multilingual query expansion expert for government information retrieval.

Original Query: "{original_query}"
Normalized Query: "{active_query}"
Language: {source_language}
English Translation: "{translated_en}"
Department: {department or "General"}

Generate a concise multilingual expansion:
1. native_variations: 1-2 natural alternative phrasings in {source_language}.
2. english_variations: 2 targeted English search queries suitable for government portals.
3. department_terms: 1-2 official department or scheme categories.
4. keyword_variations: 2-3 essential search keywords.

Output strictly valid JSON:
{{
  "native_variations": ["..."],
  "english_variations": ["..."],
  "department_terms": ["..."],
  "keyword_variations": ["..."]
}}
"""
            models = [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL]
            for model in models:
                try:
                    resp = self.client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": "You output only strictly valid JSON matching the schema."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.1,
                        response_format={"type": "json_object"},
                        timeout=15.0
                    )
                    data = json.loads(resp.choices[0].message.content.strip())
                    native_vars = data.get("native_variations", [])
                    eng_vars = data.get("english_variations", [])
                    dept_terms = data.get("department_terms", [])
                    kw_vars = data.get("keyword_variations", [])

                    all_queries = [original_query, translated_en] + eng_vars + native_vars
                    # Deduplicate while preserving order
                    deduped = list(dict.fromkeys(q.strip() for q in all_queries if q and len(q.strip()) > 3))

                    return MultilingualQueryExpansionResult(
                        original_query=original_query,
                        translated_english_query=translated_en,
                        native_variations=native_vars,
                        english_variations=eng_vars,
                        department_terms=dept_terms,
                        keyword_variations=kw_vars,
                        all_search_queries=deduped[:6]
                    )
                except Exception as e:
                    logger.warning(f"LLM expansion failed with {model}: {e}")

        # Fallback expansion
        native_vars = [active_query] if active_query != original_query else []
        eng_vars = [translated_en]
        if department:
            eng_vars.append(f"{translated_en} {department}")

        all_queries = list(dict.fromkeys([original_query, translated_en] + native_vars + eng_vars))
        return MultilingualQueryExpansionResult(
            original_query=original_query,
            translated_english_query=translated_en,
            native_variations=native_vars,
            english_variations=eng_vars,
            department_terms=[department] if department else [],
            keyword_variations=[w for w in translated_en.split() if len(w) > 3],
            all_search_queries=all_queries[:5]
        )

    def _heuristic_translate(self, query: str) -> str:
        """Rule-based translation using curated scheme dictionary."""
        tokens = query.split()
        translated_parts = []
        for token in tokens:
            cleaned = token.strip("?,.:;!\"'()").lower()
            if cleaned in self.SCHEME_TRANSLATIONS:
                translated_parts.append(self.SCHEME_TRANSLATIONS[cleaned])
            else:
                translated_parts.append(token)
        return " ".join(translated_parts)
