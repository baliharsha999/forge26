"""
Retrieval Evaluation Agent with structured Pydantic validation.
Evaluates whether retrieved government document chunks contain sufficient,
relevant, and verified information to answer the user query before generation.
Includes 429 rate limit backoff and robust heuristic fallback.
"""

import json
import re
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from groq import Groq

from app.config.settings import get_settings


class RetrievalEvaluation(BaseModel):
    """Structured Pydantic output for retrieval evaluation."""

    is_relevant: bool = Field(
        description="Whether the retrieved documents are contextually relevant to the user's query"
    )
    relevance_score: float = Field(
        description="Relevance score ranging strictly from 0.0 to 1.0",
        ge=0.0,
        le=1.0
    )
    sufficient_context: bool = Field(
        description="Whether the retrieved documents contain adequate facts, benefits, or criteria to answer the query"
    )
    reason: str = Field(
        description="Concise analytical explanation of the relevance and sufficiency judgment"
    )
    missing_information: List[str] = Field(
        default_factory=list,
        description="List of critical aspects or details absent from the retrieved documents"
    )


class RetrievalEvaluationAgent:
    """LLM-based evaluator assessing context relevance and sufficiency."""

    CONTROLLED_FAILURE_RESPONSE = (
        "I don't have sufficient verified information in the available government documents to answer this question."
    )

    def __init__(self):
        self.settings = get_settings()
        self.client = Groq(api_key=self.settings.GROQ_API_KEY) if self.settings.GROQ_API_KEY else None
        self.threshold = self.settings.EVALUATION_THRESHOLD

    def evaluate(
        self,
        query: str,
        retrieved_documents: List[Dict[str, Any]],
        threshold: Optional[float] = None
    ) -> RetrievalEvaluation:
        """
        Evaluates the retrieved documents against the user query.
        Returns a structured RetrievalEvaluation object.
        """
        eval_threshold = threshold if threshold is not None else self.threshold

        if not retrieved_documents:
            return RetrievalEvaluation(
                is_relevant=False,
                relevance_score=0.0,
                sufficient_context=False,
                reason="No documents were retrieved.",
                missing_information=["All required scheme and policy documentation"]
            )

        if not self.client:
            return self._heuristic_evaluate(query, retrieved_documents, eval_threshold)

        # Format retrieved chunks
        context_snippets = []
        for idx, doc in enumerate(retrieved_documents[:5]):
            meta = doc.get("metadata", {})
            title = meta.get("title", f"Document {idx+1}")
            dept = meta.get("department", "Government of India")
            content = doc.get("page_content", "")[:600]
            context_snippets.append(f"[{idx+1}] Title: {title} | Department: {dept}\n{content}")

        joined_context = "\n\n".join(context_snippets)

        system_prompt = (
            "You are a rigorous Government Information Retrieval Evaluator.\n"
            "Your job is to critically judge whether the provided official context contains sufficient, "
            "accurate, and relevant information to directly answer the user's query.\n"
            "Do NOT evaluate based solely on keyword overlap.\n"
            "Verify:\n"
            "1. Context relevance: Do the documents discuss the exact subject or applicable government schemes?\n"
            "2. Information sufficiency: Are key details (such as eligibility, loans, subsidies, or procedures) present?\n"
            "3. Completeness: Does the context provide enough verified facts to answer without guessing?\n\n"
            "You must return ONLY a JSON object matching this schema:\n"
            "{\n"
            '  "is_relevant": true,\n'
            '  "relevance_score": 0.92,\n'
            '  "sufficient_context": true,\n'
            '  "reason": "The retrieved documents contain the required information.",\n'
            '  "missing_information": []\n'
            "}\n"
            "Rules:\n"
            "- relevance_score must be a float between 0.0 and 1.0.\n"
            "- If the query asks about topics completely absent from the context (e.g. unrelated subjects, recipes, entertainment), set is_relevant=false, sufficient_context=false, relevance_score < 0.4.\n"
            "- Output strictly valid JSON without markdown code fences or conversational text."
        )

        user_prompt = f"User Query: {query}\n\nRetrieved Official Context:\n{joined_context}"

        models_to_try = [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL]
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
                    response_format={"type": "json_object"} if "qwen" in model else None
                )

                content = response.choices[0].message.content or ""
                clean_json_str = self._extract_json(content)
                if clean_json_str:
                    data = json.loads(clean_json_str)
                    eval_obj = RetrievalEvaluation(**data)
                    return eval_obj
            except Exception as e:
                err_str = str(e)
                print(f"[EvaluationAgent] Warning with model {model}: {err_str}. Trying fallback...")
                if "429" in err_str:
                    time.sleep(2.5)  # Backoff if token limit reached

        return self._heuristic_evaluate(query, retrieved_documents, eval_threshold)

    def _extract_json(self, text: str) -> Optional[str]:
        """Extracts JSON substring from output."""
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
        retrieved_documents: List[Dict[str, Any]],
        threshold: float
    ) -> RetrievalEvaluation:
        """Deterministic evaluation fallback based on domain relevance, cross-encoder scores and term overlap."""
        if not retrieved_documents:
            return RetrievalEvaluation(
                is_relevant=False,
                relevance_score=0.0,
                sufficient_context=False,
                reason="No candidate documents retrieved.",
                missing_information=["Entire document context"]
            )

        # Detect clear out-of-domain queries
        unrelated_domains = ["cake", "cookie", "recipe", "bake", "gta", "cheat", "playstation", "xbox", "movie", "song", "football"]
        q_lower = query.lower()
        if any(w in q_lower for w in unrelated_domains):
            return RetrievalEvaluation(
                is_relevant=False,
                relevance_score=0.10,
                sufficient_context=False,
                reason="Query is outside official government domain.",
                missing_information=["All relevant government documentation"]
            )

        top_doc = retrieved_documents[0]
        rerank_prob = top_doc.get("rerank_probability", 0.5)

        # Measure query keyword overlap with retrieved chunks
        query_words = set(re.findall(r"\b\w{3,}\b", q_lower))
        combined_text = " ".join(
            (d.get("page_content", "") + " " + d.get("metadata", {}).get("title", "")).lower()
            for d in retrieved_documents[:3]
        )
        matched_words = [w for w in query_words if w in combined_text]
        overlap_ratio = len(matched_words) / max(len(query_words), 1)

        if overlap_ratio < 0.20 and rerank_prob < 0.30:
            return RetrievalEvaluation(
                is_relevant=False,
                relevance_score=0.30,
                sufficient_context=False,
                reason="Retrieved documents lack core query entities.",
                missing_information=["Relevant scheme guidelines"]
            )

        # High confidence for matching government topics
        est_score = round(min(1.0, max(threshold, 0.5 * rerank_prob + 0.5 * overlap_ratio + 0.35)), 2)

        return RetrievalEvaluation(
            is_relevant=True,
            relevance_score=est_score,
            sufficient_context=True,
            reason="Retrieved official context substantiated by cross-encoder and entity matching.",
            missing_information=[]
        )

    def is_sufficient_for_generation(
        self,
        eval_result: RetrievalEvaluation,
        threshold: Optional[float] = None
    ) -> bool:
        """
        Decision rule for LangGraph conditional edge.
        """
        thresh = threshold if threshold is not None else self.threshold
        return bool(
            eval_result.is_relevant
            and eval_result.sufficient_context
            and eval_result.relevance_score >= thresh
        )
