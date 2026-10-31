"""
Knowledge Refinement Agent.
Analyzes retrieved context against user query to detect information gaps,
identifies answered vs. missing aspects, generates targeted gap-filling queries,
and manages iterative retrieval refinement loops.
"""

import json
import re
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from groq import Groq

from app.config.settings import get_settings


class RefinementAnalysis(BaseModel):
    """Structured output for knowledge refinement analysis."""

    answered_aspects: List[str] = Field(
        default_factory=list,
        description="Query components adequately covered in the current context"
    )
    missing_aspects: List[str] = Field(
        default_factory=list,
        description="Crucial query components, rules, limits, or steps missing from the context"
    )
    targeted_queries: List[str] = Field(
        default_factory=list,
        description="Focused search queries crafted specifically to retrieve the missing information"
    )
    retrieval_strategy_adjustments: str = Field(
        default="",
        description="Guidance on keyword expansion, department scoping, or terminology tuning"
    )
    should_continue_refinement: bool = Field(
        default=True,
        description="True if refinement is needed and remaining attempts exist"
    )


class KnowledgeRefinementAgent:
    """Agent that diagnoses context deficiencies and generates targeted gap-filling queries."""

    MAX_REFINEMENT_ATTEMPTS = 2

    def __init__(self):
        self.settings = get_settings()
        self.client = Groq(api_key=self.settings.GROQ_API_KEY) if self.settings.GROQ_API_KEY else None

    def analyze_and_refine(
        self,
        query: str,
        retrieved_documents: List[Dict[str, Any]],
        current_attempt: int,
        eval_result: Optional[Dict[str, Any]] = None
    ) -> RefinementAnalysis:
        """
        Compares query with retrieved documents, extracts answered vs. missing aspects,
        and generates focused search queries if attempts remain.
        """
        # If max attempts reached, stop refinement
        if current_attempt >= self.MAX_REFINEMENT_ATTEMPTS:
            return RefinementAnalysis(
                answered_aspects=[],
                missing_aspects=["Max refinement iterations reached without complete coverage."],
                targeted_queries=[],
                retrieval_strategy_adjustments="Refinement limit reached; aborting loop.",
                should_continue_refinement=False
            )

        if not self.client:
            return self._heuristic_refine(query, retrieved_documents, eval_result)

        context_summary = []
        for i, d in enumerate(retrieved_documents[:4]):
            title = d.get("metadata", {}).get("title", "")
            preview = d.get("page_content", "")[:350]
            context_summary.append(f"[{i+1}] {title}:\n{preview}")
        joined_summary = "\n\n".join(context_summary)

        eval_missing = eval_result.get("missing_information", []) if eval_result else []
        eval_missing_str = ", ".join(eval_missing) if eval_missing else "Not specified"

        system_prompt = (
            "You are an expert Knowledge Refinement Agent for Government Information Retrieval.\n"
            "Your task is to analyze what the user asked vs. what was actually retrieved.\n"
            "Identify:\n"
            "1. Which specific aspects are answered.\n"
            "2. Which specific aspects are missing (e.g., eligibility, subsidy limits, dates, procedure).\n"
            "3. Formulate 2 to 3 targeted, high-precision search queries to fetch only the missing information.\n\n"
            "Return ONLY a JSON object matching:\n"
            "{\n"
            '  "answered_aspects": ["Benefits available", "..."],\n'
            '  "missing_aspects": ["Eligibility criteria", "..."],\n'
            '  "targeted_queries": [\n'
            '    "Exact missing aspect query with scheme name",\n'
            '    "Alternative terminology for missing criteria"\n'
            '  ],\n'
            '  "retrieval_strategy_adjustments": "Explanation of adjustment",\n'
            '  "should_continue_refinement": true\n'
            "}"
        )

        user_prompt = (
            f"User Query: {query}\n\n"
            f"Currently Retrieved Context Summary:\n{joined_summary}\n\n"
            f"Prior Evaluator Missing Notes: {eval_missing_str}\n"
            f"Refinement Attempt: {current_attempt + 1} of {self.MAX_REFINEMENT_ATTEMPTS}"
        )

        models_to_try = [m for m in [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL] if "20b" not in m.lower()]
        for model in models_to_try:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=500,
                    response_format={"type": "json_object"} if "qwen" in model else None,
                    timeout=8.0
                )
                content = response.choices[0].message.content or ""
                clean_json = self._extract_json(content)
                if clean_json:
                    data = json.loads(clean_json)
                    data["should_continue_refinement"] = bool(data.get("missing_aspects") and data.get("targeted_queries"))
                    return RefinementAnalysis(**data)
            except Exception as e:
                print(f"[RefinementAgent] Model {model} warning: {e}. Trying fallback...")

        return self._heuristic_refine(query, retrieved_documents, eval_result)

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

    def _heuristic_refine(
        self,
        query: str,
        retrieved_documents: List[Dict[str, Any]],
        eval_result: Optional[Dict[str, Any]]
    ) -> RefinementAnalysis:
        """Deterministic refinement generator."""
        eval_missing = eval_result.get("missing_information", []) if eval_result else []
        combined_text = " ".join(d.get("page_content", "").lower() for d in retrieved_documents[:3])

        missing = []
        answered = []
        targeted = []

        aspect_checks = [
            ("eligibility", "Eligibility criteria and conditions"),
            ("benefit", "Scheme benefits and financial assistance"),
            ("apply", "Application process and documents required"),
            ("subsidy", "Subsidy percentage and grant limits")
        ]

        for term, label in aspect_checks:
            if term in query.lower():
                if term in combined_text:
                    answered.append(label)
                else:
                    missing.append(label)
                    targeted.append(f"{query} {label.lower()}")

        if eval_missing:
            for m in eval_missing:
                if m not in missing:
                    missing.append(m)
                    targeted.append(f"{query} {m}")

        if not targeted:
            targeted = [f"{query} detailed official guidelines and eligibility"]

        return RefinementAnalysis(
            answered_aspects=answered or ["General overview"],
            missing_aspects=missing or ["Detailed requirements"],
            targeted_queries=targeted[:3],
            retrieval_strategy_adjustments="Targeting specific missing aspects with exact terminology.",
            should_continue_refinement=len(missing) > 0
        )

    @staticmethod
    def merge_and_deduplicate_chunks(
        existing_chunks: List[Dict[str, Any]],
        new_chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Merges newly retrieved chunks with existing chunks, preserving earlier ranks
        and eliminating duplicate chunk IDs or identical content.
        """
        seen_ids = set()
        merged = []

        for c in existing_chunks:
            cid = c.get("metadata", {}).get("chunk_id") or c.get("chunk_id") or hash(c.get("page_content", ""))
            if cid not in seen_ids:
                seen_ids.add(cid)
                merged.append(c)

        for c in new_chunks:
            cid = c.get("metadata", {}).get("chunk_id") or c.get("chunk_id") or hash(c.get("page_content", ""))
            if cid not in seen_ids:
                seen_ids.add(cid)
                merged.append(c)

        return merged
