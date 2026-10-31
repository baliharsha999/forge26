"""
Generator Evaluation Metrics:
Measures Faithfulness, Answer Relevancy, and Contextual Relevancy.
"""

import re
from typing import Dict, Any, List
import numpy as np
from groq import Groq
from app.config.settings import get_settings


def evaluate_faithfulness_llm(answer: str, context: str, client: Groq, model: str) -> float:
    """
    Evaluates whether facts stated in the answer are supported by the retrieved context.
    Returns faithfulness score between 0.0 and 1.0.
    """
    if not answer.strip() or not context.strip():
        return 0.0

    prompt = (
        "You are an impartial evaluator checking FAITHFULNESS in a RAG system.\n"
        "Check whether every claim made in the Answer is directly supported by the Provided Context.\n"
        "Score from 0.0 to 1.0 (1.0 = completely faithful, zero ungrounded statements; 0.0 = pure hallucination).\n"
        "Return ONLY a decimal number between 0.0 and 1.0.\n\n"
        f"Context:\n{context[:2000]}\n\n"
        f"Answer:\n{answer}\n\n"
        "Score:"
    )

    try:
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=20
        )
        txt = res.choices[0].message.content or ""
        match = re.search(r"(\d+(\.\d+)?)", txt)
        if match:
            return min(1.0, max(0.0, float(match.group(1))))
    except Exception:
        pass

    return evaluate_lexical_overlap(answer, context)


def evaluate_answer_relevancy_llm(answer: str, query: str, client: Groq, model: str) -> float:
    """
    Evaluates how directly and completely the answer addresses the user's question.
    Returns relevancy score between 0.0 and 1.0.
    """
    prompt = (
        "You are an impartial evaluator checking ANSWER RELEVANCY.\n"
        "Assess how directly the Answer addresses the User Query.\n"
        "Score from 0.0 to 1.0 (1.0 = directly addresses all parts of the question; 0.0 = off topic).\n"
        "Return ONLY a decimal number between 0.0 and 1.0.\n\n"
        f"User Query: {query}\n"
        f"Answer: {answer}\n\n"
        "Score:"
    )

    try:
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=20
        )
        txt = res.choices[0].message.content or ""
        match = re.search(r"(\d+(\.\d+)?)", txt)
        if match:
            return min(1.0, max(0.0, float(match.group(1))))
    except Exception:
        pass

    return evaluate_lexical_overlap(query, answer)


def evaluate_contextual_relevancy_llm(context: str, query: str, client: Groq, model: str) -> float:
    """
    Measures the ratio of useful, query-relevant sentences inside the retrieved context.
    """
    prompt = (
        "You are an impartial evaluator checking CONTEXTUAL RELEVANCY.\n"
        "Assess whether the retrieved government context contains information relevant to the user query.\n"
        "Score from 0.0 to 1.0.\n"
        "Return ONLY a decimal number between 0.0 and 1.0.\n\n"
        f"Query: {query}\n"
        f"Context:\n{context[:2000]}\n\n"
        "Score:"
    )

    try:
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=20
        )
        txt = res.choices[0].message.content or ""
        match = re.search(r"(\d+(\.\d+)?)", txt)
        if match:
            return min(1.0, max(0.0, float(match.group(1))))
    except Exception:
        pass

    return evaluate_lexical_overlap(query, context)


def evaluate_lexical_overlap(text_a: str, text_b: str) -> float:
    """Deterministic token overlap fallback."""
    tokens_a = set(re.findall(r"\b\w{3,}\b", text_a.lower()))
    tokens_b = set(re.findall(r"\b\w{3,}\b", text_b.lower()))
    if not tokens_a:
        return 0.0
    common = tokens_a.intersection(tokens_b)
    return len(common) / len(tokens_a)


class GeneratorEvaluator:
    """Evaluates generation quality using Faithfulness, Answer Relevancy, and Contextual Relevancy."""

    def __init__(self):
        settings = get_settings()
        self.client = Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None
        self.model = settings.FALLBACK_MODEL

    def evaluate(self, query: str, answer: str, context: str) -> Dict[str, float]:
        """Runs the three generator evaluation metrics."""
        if not self.client:
            return {
                "faithfulness": evaluate_lexical_overlap(answer, context),
                "answer_relevancy": evaluate_lexical_overlap(query, answer),
                "contextual_relevancy": evaluate_lexical_overlap(query, context)
            }

        return {
            "faithfulness": evaluate_faithfulness_llm(answer, context, self.client, self.model),
            "answer_relevancy": evaluate_answer_relevancy_llm(answer, query, self.client, self.model),
            "contextual_relevancy": evaluate_contextual_relevancy_llm(context, query, self.client, self.model)
        }
