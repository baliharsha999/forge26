"""
End-to-End RAG Evaluation Module.
Evaluates Answer Correctness, Citation Correctness, Hallucination Rate,
and Retrieval Failure Handling on negative/out-of-scope queries.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from app.agents.evaluation_agent import RetrievalEvaluationAgent


def evaluate_citation_correctness(citations: List[Dict[str, Any]], expected_substr: Optional[str]) -> float:
    """
    Verifies whether generated citations contain valid official government URLs
    matching expected scheme sources.
    """
    if not expected_substr:
        # If query was out of domain, valid citation count is 0
        return 1.0 if not citations else 0.0

    if not citations:
        return 0.0

    valid_count = 0
    for c in citations:
        url = c.get("url", "")
        # Check if URL belongs to trusted domain and matches scheme identifier
        if (".gov.in" in url or ".nic.in" in url) and (expected_substr.lower() in url.lower()):
            valid_count += 1

    return valid_count / len(citations)


def evaluate_retrieval_failure_handling(
    is_in_domain: bool,
    final_answer: str,
    eval_result: Optional[Dict[str, Any]]
) -> float:
    """
    Checks whether the system correctly refrains from answering when
    a question is out of domain or retrieval failed.
    """
    controlled_text = RetrievalEvaluationAgent.CONTROLLED_FAILURE_RESPONSE

    if not is_in_domain:
        # Must return the controlled refusal statement
        if controlled_text.lower() in final_answer.lower():
            return 1.0
        return 0.0
    else:
        # If in domain and retrieved, must NOT return the refusal
        if controlled_text.lower() not in final_answer.lower():
            return 1.0
        return 0.0


def evaluate_answer_correctness_simple(generated_answer: str, ground_truth: str) -> float:
    """
    Compares generated answer against reference ground truth using key entity overlap.
    """
    import re
    gt_tokens = set(re.findall(r"\b\w{4,}\b", ground_truth.lower()))
    gen_tokens = set(re.findall(r"\b\w{4,}\b", generated_answer.lower()))

    if not gt_tokens:
        return 1.0

    overlap = gt_tokens.intersection(gen_tokens)
    return min(1.0, len(overlap) / (len(gt_tokens) * 0.7))


def evaluate_hallucination_rate(generated_answer: str, context: str) -> float:
    """
    Estimates hallucination rate (ratio of key claim tokens unsupported by context).
    0.0 = zero hallucinations, 1.0 = completely fabricated.
    """
    import re
    answer_tokens = set(re.findall(r"\b\w{4,}\b", generated_answer.lower()))
    context_tokens = set(re.findall(r"\b\w{4,}\b", context.lower()))

    if not answer_tokens:
        return 0.0

    unsupported = [t for t in answer_tokens if t not in context_tokens]
    # Filter common conversational words
    stop = {"government", "scheme", "under", "following", "provided", "official", "based", "please", "details"}
    unsupported_filtered = [t for t in unsupported if t not in stop]

    return round(len(unsupported_filtered) / len(answer_tokens), 3)
