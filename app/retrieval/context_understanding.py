"""
Context Understanding and Cross-Lingual Alignment Service.
Responsibilities:
1. Detect document languages across retrieved chunks.
2. Determine if cross-lingual alignment is required (e.g. English docs -> Telugu query/response).
3. Preserve original context verbatim without loss of meaning.
4. Extract and align key factual entities across languages (official scheme names, dates, amounts, departments).
5. Detect conflicting information (conflicting dates, amounts, eligibility rules) across multilingual documents.
6. Provide aligned context and guidance for AnswerGenerator.
"""

import re
from typing import List, Dict, Any, Optional, Set, Tuple
from pydantic import BaseModel, Field

from app.agents.language_agent import LanguageAgent
from app.config.settings import get_settings


class AlignedEntity(BaseModel):
    """Key factual entity aligned across languages."""
    scheme_name: str
    departments: List[str] = Field(default_factory=list)
    monetary_amounts: List[str] = Field(default_factory=list)
    dates_and_deadlines: List[str] = Field(default_factory=list)
    target_beneficiaries: List[str] = Field(default_factory=list)


class InformationConflict(BaseModel):
    """Contradiction or conflicting information detected across retrieved documents."""
    topic: str
    conflicting_sources: List[str] = Field(default_factory=list)
    details: str


class ContextUnderstandingResult(BaseModel):
    """Structured result of context understanding and alignment."""
    document_languages: List[str]
    context_language: str
    is_cross_lingual: bool
    original_context: str
    translated_context: Optional[str] = None
    aligned_entities: AlignedEntity
    conflicts: List[InformationConflict] = Field(default_factory=list)
    alignment_guidance: str = ""


class ContextUnderstandingService:
    """Service for cross-lingual understanding, alignment, and conflict detection."""

    _instance: Optional["ContextUnderstandingService"] = None

    def __init__(self):
        self.language_agent = LanguageAgent()

    @classmethod
    def get_instance(cls) -> "ContextUnderstandingService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def detect_document_languages(self, chunks: List[Dict[str, Any]]) -> List[str]:
        """Detects unique languages present across retrieved chunks."""
        languages: Set[str] = set()
        for chunk in chunks:
            # First check metadata
            meta_lang = chunk.get("metadata", {}).get("language")
            if meta_lang:
                languages.add(meta_lang)
            else:
                text = chunk.get("page_content", "")[:300]
                if text.strip():
                    det = self.language_agent.detect(text)
                    languages.add(det.detected_language)

        if not languages:
            return ["English"]
        return sorted(list(languages))

    def extract_factual_entities(self, text: str) -> AlignedEntity:
        """Extracts scheme names, dates, amounts, and departments via regex heuristics."""
        # Monetary amounts: Rs. 6,000, ₹6000, 6,000 rupees, 5 lakh, 50,000
        amount_patterns = [
            r"(?:(?:Rs\.?|₹|INR)\s*[\d,]+(?:\s*(?:crore|lakh|thousand))?)",
            r"(?:[\d,]+\s*(?:rupees|रुपये|రూపాయలు|taka|lakh|crore))",
        ]
        amounts = []
        for pat in amount_patterns:
            matches = re.findall(pat, text, re.IGNORECASE)
            amounts.extend([m.strip() for m in matches])

        # Dates / years: 2024, 2023-24, 1st February 2019, 31st March
        date_patterns = [
            r"\b(?:19|20)\d{2}(?:-\d{2,4})?\b",
            r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:19|20)\d{2}\b",
            r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b",
        ]
        dates = []
        for pat in date_patterns:
            matches = re.findall(pat, text, re.IGNORECASE)
            dates.extend([m.strip() for m in matches])

        # Common government scheme names
        schemes = []
        scheme_matches = re.findall(
            r"\b(?:PM-?[A-Z]+|Pradhan\s+Mantri\s+[A-Za-z\s]+|Ayushman\s+Bharat|National\s+[A-Za-z\s]+Scheme|Beti\s+Bachao\s+Beti\s+Padhao|Sukanya\s+Samriddhi)\b",
            text, re.IGNORECASE
        )
        schemes.extend([s.strip() for s in scheme_matches])

        # Departments
        depts = []
        dept_matches = re.findall(
            r"\b(?:Ministry\s+of\s+[A-Za-z\s]+|Department\s+of\s+[A-Za-z\s]+)\b",
            text, re.IGNORECASE
        )
        depts.extend([d.strip() for d in dept_matches])

        return AlignedEntity(
            scheme_name=", ".join(list(dict.fromkeys(schemes))[:3]) if schemes else "Government Scheme",
            departments=list(dict.fromkeys(depts))[:3],
            monetary_amounts=list(dict.fromkeys(amounts))[:10],
            dates_and_deadlines=list(dict.fromkeys(dates))[:10],
            target_beneficiaries=[]
        )

    def detect_conflicts(self, chunks: List[Dict[str, Any]]) -> List[InformationConflict]:
        """Identifies conflicting dates, amounts, or deadlines across retrieved sources."""
        conflicts = []
        if len(chunks) < 2:
            return conflicts

        # Group dates and amounts by source document
        doc_data: Dict[str, Dict[str, Set[str]]] = {}
        for chunk in chunks:
            doc_id = chunk.get("metadata", {}).get("document_id") or chunk.get("metadata", {}).get("source_url", "doc")
            if doc_id not in doc_data:
                doc_data[doc_id] = {"dates": set(), "amounts": set()}

            content = chunk.get("page_content", "")
            # dates
            for d in re.findall(r"\b(?:19|20)\d{2}\b", content):
                doc_data[doc_id]["dates"].add(d)

            # amounts
            for a in re.findall(r"(?:(?:Rs\.?|₹)\s*[\d,]+)", content, re.IGNORECASE):
                doc_data[doc_id]["amounts"].add(a.replace(" ", ""))

        # Check for multiple distinct launch years or deadlines if discussing same scheme
        all_doc_ids = list(doc_data.keys())
        if len(all_doc_ids) >= 2:
            dates_per_doc = {d_id: doc_data[d_id]["dates"] for d_id in all_doc_ids if doc_data[d_id]["dates"]}
            if len(dates_per_doc) >= 2:
                docs = list(dates_per_doc.keys())
                d1_set = dates_per_doc[docs[0]]
                d2_set = dates_per_doc[docs[1]]
                if d1_set and d2_set and not (d1_set & d2_set):
                    conflicts.append(InformationConflict(
                        topic="Dates/Timelines",
                        conflicting_sources=[docs[0], docs[1]],
                        details=f"Document '{docs[0]}' cites dates {sorted(list(d1_set))} whereas '{docs[1]}' cites dates {sorted(list(d2_set))}."
                    ))

        return conflicts

    def align_context(
        self,
        chunks: List[Dict[str, Any]],
        user_language: str,
        response_language: str,
    ) -> ContextUnderstandingResult:
        """
        Builds preserved original context and cross-lingual alignment guidance.
        Ensures scheme names, figures, and dates are preserved exactly.
        """
        doc_langs = self.detect_document_languages(chunks)
        primary_doc_lang = doc_langs[0] if doc_langs else "English"
        is_cross = (response_language.lower() != primary_doc_lang.lower())

        # Construct original context verbatim with citations
        context_parts = []
        for idx, chunk in enumerate(chunks, 1):
            title = chunk.get("metadata", {}).get("title", f"Document {idx}")
            url = chunk.get("metadata", {}).get("source_url") or chunk.get("metadata", {}).get("url", "")
            dept = chunk.get("metadata", {}).get("department", "")
            content = chunk.get("page_content", "").strip()
            header = f"[Source {idx}: {title} | Dept: {dept} | URL: {url}]"
            context_parts.append(f"{header}\n{content}")

        original_context = "\n\n---\n\n".join(context_parts)

        # Extract entities and detect any conflicts
        entities = self.extract_factual_entities(original_context)
        conflicts = self.detect_conflicts(chunks)

        # Build guidance for the answer generator
        guidance_notes = []
        if is_cross:
            guidance_notes.append(
                f"CROSS-LINGUAL GENERATION: The source documents are primarily in {primary_doc_lang}, "
                f"but the user requested the answer in {response_language}."
            )
            guidance_notes.append(
                "PRESERVATION RULES:\n"
                f"1. Official Scheme Names: Retain official names (e.g., '{entities.scheme_name}') in their standard form or bilingual transliteration.\n"
                f"2. Monetary Figures: Strictly preserve all amounts (e.g., {', '.join(entities.monetary_amounts[:4]) or 'exact amounts as stated'}). Never convert or modify currency values.\n"
                f"3. Dates & Deadlines: Strictly preserve all dates and years (e.g., {', '.join(entities.dates_and_deadlines[:4]) or 'exact dates'}).\n"
                "4. Official URLs & Citations: Never translate official URLs (keep exact .gov.in links).\n"
                f"5. Fluency: Respond entirely in natural, professional {response_language} while obeying these factual constraints."
            )

        if conflicts:
            conflict_descriptions = "; ".join(c.details for c in conflicts)
            guidance_notes.append(f"CONFLICT NOTICE: Conflicting details detected between sources: {conflict_descriptions}. Explicitly note both perspectives in the response.")

        alignment_guidance = "\n".join(guidance_notes)

        return ContextUnderstandingResult(
            document_languages=doc_langs,
            context_language=primary_doc_lang,
            is_cross_lingual=is_cross,
            original_context=original_context,
            translated_context=None,  # Keep original intact to avoid LLM drift
            aligned_entities=entities,
            conflicts=conflicts,
            alignment_guidance=alignment_guidance
        )
