"""
Answerability Evaluation Module.
Distinct from Retrieval Evaluation: specifically evaluates whether the retrieved context
contains all necessary facts, criteria, and numbers to directly answer the user's specific query.
"""

import json
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from groq import Groq

from app.config.settings import get_settings


class AnswerabilityEvaluation(BaseModel):
    """Structured Pydantic model for answerability evaluation."""

    is_answerable: bool = Field(
        description="Whether the retrieved context provides sufficient facts to answer the question completely"
    )
    answerability_score: float = Field(
        description="Score between 0.0 and 1.0 representing completeness of required information",
        ge=0.0,
        le=1.0
    )
    missing_aspects: List[str] = Field(
        default_factory=list,
        description="Specific components or requirements of the question absent in the context"
    )
    reason: str = Field(
        description="Detailed analytical reason justifying the answerability verdict"
    )


class AnswerabilityEvaluator:
    """Evaluates question answerability from verified and compressed context."""

    def __init__(self):
        self.settings = get_settings()
        self.client = Groq(api_key=self.settings.GROQ_API_KEY) if self.settings.GROQ_API_KEY else None
        self.threshold = 0.70

    def evaluate(
        self,
        query: str,
        context_documents: List[Dict[str, Any]]
    ) -> AnswerabilityEvaluation:
        """
        Determines whether the provided context contains sufficient facts to answer the query.
        """
        if not context_documents:
            return AnswerabilityEvaluation(
                is_answerable=False,
                answerability_score=0.0,
                missing_aspects=["Entire context missing"],
                reason="No documents available in context."
            )

        if not self.client:
            return self._heuristic_evaluate(query, context_documents)

        snippets = []
        for i, doc in enumerate(context_documents[:4]):
            title = doc.get("metadata", {}).get("title", f"Doc {i+1}")
            content = doc.get("page_content", "")[:500]
            snippets.append(f"[{i+1}] {title}:\n{content}")
        joined_context = "\n\n".join(snippets)

        system_prompt = (
            "You are an impartial Government RAG Answerability Evaluator.\n"
            "Your sole focus is to judge whether the user's question can be FULLY answered from the provided text.\n"
            "NOTE THE DIFFERENCE:\n"
            "- A document may be RELEVANT (e.g. discussing the same scheme) but the question might still NOT BE ANSWERABLE "
            "(e.g. user asks for exact eligibility criteria or age limits, but text only mentions benefits).\n\n"
            "Return strictly a JSON object matching:\n"
            "{\n"
            '  "is_answerable": true,\n'
            '  "answerability_score": 0.88,\n'
            '  "missing_aspects": [],\n'
            '  "reason": "The context provides the exact subsidy numbers, loan slabs, and eligibility requirements requested."\n'
            "}\n"
            "Rules:\n"
            "- If any core part of the question is missing, set is_answerable=false, list missing_aspects, score < 0.65.\n"
            "- Output valid JSON only."
        )

        user_prompt = f"Question: \"{query}\"\n\nRetrieved Context:\n{joined_context}"

        models_to_try = [m for m in [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL] if "20b" not in m.lower()]
        for model in models_to_try:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.0,
                    max_tokens=600,
                    response_format={"type": "json_object"} if "qwen" in model else None,
                    timeout=8.0
                )
                content = response.choices[0].message.content or ""
                clean_json = self._extract_json(content)
                if clean_json:
                    data = json.loads(clean_json)
                    return AnswerabilityEvaluation(**data)
            except Exception as e:
                print(f"[AnswerabilityEvaluator] Warning with model {model}: {e}")

        return self._heuristic_evaluate(query, context_documents)

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

    def _heuristic_evaluate(
        self,
        query: str,
        context_documents: List[Dict[str, Any]]
    ) -> AnswerabilityEvaluation:
        """Deterministic lexical answerability fallback."""
        q_lower = query.lower()
        combined_text = " ".join(d.get("page_content", "").lower() for d in context_documents[:3])

        missing = []
        if "eligib" in q_lower and not any(k in combined_text for k in ["eligib", "criteria", "qualification", "age", "who can"]):
            missing.append("Eligibility criteria")
        if any(b in q_lower for b in ["benefit", "subsidy", "amount", "loan"]) and not any(k in combined_text for k in ["benefit", "subsidy", "rs", "₹", "lakh", "assistance", "loan"]):
            missing.append("Financial benefits & loan amounts")
        if any(p in q_lower for p in ["apply", "process", "procedure"]) and not any(k in combined_text for k in ["apply", "application", "portal", "process", "document"]):
            missing.append("Application process")

        # Specific targeted financial / technical criteria checks
        for term in ["cibil", "credit score", "interest rate", "deadline", "penalty", "turnover"]:
            if term in q_lower and term not in combined_text:
                missing.append(f"Specific requirement: {term.upper()}")

        is_ans = len(missing) == 0
        score = 0.90 if is_ans else 0.40

        return AnswerabilityEvaluation(
            is_answerable=is_ans,
            answerability_score=score,
            missing_aspects=missing,
            reason="All targeted requirements found in context." if is_ans else f"Missing key requirements: {', '.join(missing)}"
        )
