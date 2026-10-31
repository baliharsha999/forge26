"""
Query Analysis & Advanced Rewriting Agent.
Generates multi-faceted retrieval queries: semantic, keyword-oriented,
department-specific, alternative phrasings, and queries targeting missing information.
"""

import json
import re
from typing import List, Optional
from pydantic import BaseModel, Field
from groq import Groq

from app.config.settings import get_settings


class QueryAnalysis(BaseModel):
    """Structured output representation for query analysis."""

    intent: str = Field(description="The primary user intention or need")
    topic: str = Field(description="The core government policy or scheme topic")
    department: Optional[str] = Field(
        default=None,
        description="Relevant ministry or government department"
    )
    requires_current_info: bool = Field(
        default=True,
        description="Whether the query requires up-to-date policy information"
    )
    entities: List[str] = Field(
        default_factory=list,
        description="Named entities such as scheme abbreviations, programs, states, demographics"
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="Critical search terms and domain keywords"
    )
    rewritten_queries: List[str] = Field(
        default_factory=list,
        description="High-recall search queries targeting official government documentation"
    )


class MultiQueryRewriting(BaseModel):
    """Structured multi-strategy query rewriting output."""

    semantic_queries: List[str] = Field(
        default_factory=list,
        description="Conceptual and conversational variations for dense embedding retrieval"
    )
    keyword_queries: List[str] = Field(
        default_factory=list,
        description="Keyword-dense variations tailored for BM25 sparse matching"
    )
    alternative_queries: List[str] = Field(
        default_factory=list,
        description="Synonymous phrasings and colloquial equivalents"
    )
    department_queries: List[str] = Field(
        default_factory=list,
        description="Queries scoped with specific ministry or department terminology"
    )
    missing_info_queries: List[str] = Field(
        default_factory=list,
        description="Targeted queries generated from knowledge refinement to fill information gaps"
    )
    all_queries: List[str] = Field(
        default_factory=list,
        description="Deduplicated consolidation of all generated search queries"
    )


class QueryAnalysisAgent:
    """Agent that analyzes intent and performs multi-strategy query rewriting."""

    def __init__(self):
        self.settings = get_settings()
        self.client = Groq(api_key=self.settings.GROQ_API_KEY) if self.settings.GROQ_API_KEY else None

    def analyze(self, query: str) -> QueryAnalysis:
        """Analyzes user query and returns structured QueryAnalysis."""
        if not self.client:
            return self._heuristic_analysis(query)

        system_prompt = (
            "You are an expert Government Information Retrieval Specialist.\n"
            "Analyze user queries regarding Indian government schemes, subsidies, and regulations.\n"
            "Return ONLY a JSON object matching this schema:\n"
            "{\n"
            '  "intent": "user intent description",\n'
            '  "topic": "topic description",\n'
            '  "department": "ministry/department name or null",\n'
            '  "requires_current_info": true,\n'
            '  "entities": ["entity1", "entity2"],\n'
            '  "keywords": ["keyword1", "keyword2"],\n'
            '  "rewritten_queries": ["query1", "query2"]\n'
            "}\n"
            "Output must be strictly raw JSON."
        )

        user_prompt = f"User query: \"{query}\""

        models_to_try = [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL]
        for model in models_to_try:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=600,
                    response_format={"type": "json_object"} if "qwen" in model else None
                )
                content = response.choices[0].message.content or ""
                clean_json_str = self._extract_json(content)
                if clean_json_str:
                    data = json.loads(clean_json_str)
                    return QueryAnalysis(**data)
            except Exception as e:
                print(f"[QueryAgent] Warning with model {model}: {e}. Retrying...")

        return self._heuristic_analysis(query)

    def rewrite_advanced(
        self,
        query: str,
        department: Optional[str] = None,
        decomposed_queries: Optional[List[str]] = None,
        missing_aspects: Optional[List[str]] = None
    ) -> MultiQueryRewriting:
        """
        Generates 5 distinct query types:
        1. Semantic queries
        2. Keyword-oriented queries
        3. Alternative queries
        4. Department-specific queries
        5. Queries based on missing information
        """
        dept_str = department or "Government of India"
        missing_str = ", ".join(missing_aspects) if missing_aspects else "None"
        decomposed_str = ", ".join(decomposed_queries) if decomposed_queries else "None"

        if not self.client:
            return self._heuristic_advanced_rewrite(query, dept_str, missing_aspects)

        system_prompt = (
            "You are an Advanced Query Rewriting Agent for a Government Information RAG System.\n"
            "Generate five categories of high-precision search queries without changing the user's intent:\n"
            "1. semantic_queries: 2 conceptual queries for dense vector retrieval.\n"
            "2. keyword_queries: 2 keyword-dense queries (names, codes, acronyms) for BM25 sparse search.\n"
            "3. alternative_queries: 2 alternative phrasings/synonyms.\n"
            "4. department_queries: 2 queries explicitly including the relevant Ministry/Department.\n"
            "5. missing_info_queries: targeted queries addressing any identified missing aspects (or empty if none).\n\n"
            "Return strictly a JSON object matching:\n"
            "{\n"
            '  "semantic_queries": ["...", "..."],\n'
            '  "keyword_queries": ["...", "..."],\n'
            '  "alternative_queries": ["...", "..."],\n'
            '  "department_queries": ["...", "..."],\n'
            '  "missing_info_queries": ["..."]\n'
            "}"
        )

        user_prompt = (
            f"Original Query: \"{query}\"\n"
            f"Target Department: {dept_str}\n"
            f"Decomposed Subqueries: {decomposed_str}\n"
            f"Missing Information Aspects: {missing_str}"
        )

        models_to_try = [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL]
        for model in models_to_try:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=650,
                    response_format={"type": "json_object"} if "qwen" in model else None
                )
                content = response.choices[0].message.content or ""
                clean_json_str = self._extract_json(content)
                if clean_json_str:
                    data = json.loads(clean_json_str)
                    # Aggregate all unique queries
                    all_q = [query]
                    for cat in ["semantic_queries", "keyword_queries", "alternative_queries", "department_queries", "missing_info_queries"]:
                        all_q.extend(data.get(cat, []))
                    if decomposed_queries:
                        all_q.extend(decomposed_queries)

                    # Deduplicate while preserving order
                    seen = set()
                    deduped = []
                    for q in all_q:
                        clean_q = q.strip()
                        if clean_q and clean_q.lower() not in seen:
                            seen.add(clean_q.lower())
                            deduped.append(clean_q)

                    data["all_queries"] = deduped
                    return MultiQueryRewriting(**data)
            except Exception as e:
                print(f"[QueryAgent] Rewriting model warning {model}: {e}")

        return self._heuristic_advanced_rewrite(query, dept_str, missing_aspects)

    def _extract_json(self, text: str) -> Optional[str]:
        text = text.strip()
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1).strip()
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return text[start:end + 1]
        return None

    def _heuristic_analysis(self, query: str) -> QueryAnalysis:
        words = [w for w in re.findall(r"\b\w+\b", query) if len(w) > 3]
        return QueryAnalysis(
            intent=f"Retrieve government schemes related to {query}",
            topic=query,
            department="Government of India",
            requires_current_info=True,
            entities=words[:3],
            keywords=words,
            rewritten_queries=[query, f"Government schemes for {query}"]
        )

    def _heuristic_advanced_rewrite(
        self,
        query: str,
        department: str,
        missing_aspects: Optional[List[str]] = None
    ) -> MultiQueryRewriting:
        words = [w for w in re.findall(r"\b\w+\b", query) if len(w) > 2]
        keywords = " ".join(words[:5])

        semantic = [f"Official central government schemes and assistance for {query}", f"{query} policy guidelines"]
        keyword_q = [f"{keywords} scheme guidelines eligibility", f"{keywords} official notification portal"]
        alternative = [f"How to get government benefits for {query}", f"{query} financial assistance programs"]
        dept_q = [f"{department} official schemes for {query}", f"{query} under {department}"]
        missing_q = [f"{query} {aspect}" for aspect in (missing_aspects or [])]

        all_q = list(dict.fromkeys([query] + semantic + keyword_q + alternative + dept_q + missing_q))

        return MultiQueryRewriting(
            semantic_queries=semantic,
            keyword_queries=keyword_q,
            alternative_queries=alternative,
            department_queries=dept_q,
            missing_info_queries=missing_q,
            all_queries=all_q
        )
