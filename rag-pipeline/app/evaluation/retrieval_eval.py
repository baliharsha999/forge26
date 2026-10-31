"""
Retrieval Evaluation Metrics:
Calculates Precision@K, Recall@K, Mean Reciprocal Rank (MRR), Hit@K,
Contextual Precision, and Contextual Recall.
"""

from typing import List, Set, Dict, Any
import numpy as np


def precision_at_k(retrieved_ids: List[str], relevant_ids: Set[str], k: int) -> float:
    """Calculates Precision at rank K: (relevant retrieved in top K) / K."""
    if k <= 0:
        return 0.0
    top_k = retrieved_ids[:k]
    relevant_retrieved = sum(1 for doc_id in top_k if doc_id in relevant_ids)
    return relevant_retrieved / k


def recall_at_k(retrieved_ids: List[str], relevant_ids: Set[str], k: int) -> float:
    """Calculates Recall at rank K: (relevant retrieved in top K) / (total relevant)."""
    if not relevant_ids:
        return 1.0 if not retrieved_ids else 0.0
    top_k = retrieved_ids[:k]
    relevant_retrieved = sum(1 for doc_id in top_k if doc_id in relevant_ids)
    return relevant_retrieved / len(relevant_ids)


def reciprocal_rank(retrieved_ids: List[str], relevant_ids: Set[str]) -> float:
    """Calculates Reciprocal Rank: 1 / rank of the first relevant document."""
    for rank, doc_id in enumerate(retrieved_ids, start=1):
        if doc_id in relevant_ids:
            return 1.0 / rank
    return 0.0


def hit_at_k(retrieved_ids: List[str], relevant_ids: Set[str], k: int) -> float:
    """Calculates Hit@K: 1.0 if at least one relevant document is in top K, else 0.0."""
    top_k = retrieved_ids[:k]
    return 1.0 if any(doc_id in relevant_ids for doc_id in top_k) else 0.0


def contextual_precision(retrieved_docs: List[Dict[str, Any]], relevant_ids: Set[str]) -> float:
    """
    Weighted contextual precision calculating average precision across all relevant ranks.
    """
    if not relevant_ids or not retrieved_docs:
        return 0.0

    precisions = []
    relevant_count = 0
    for idx, item in enumerate(retrieved_docs, start=1):
        doc_id = item.get("metadata", {}).get("document_id", "")
        if doc_id in relevant_ids:
            relevant_count += 1
            precisions.append(relevant_count / idx)

    return float(np.mean(precisions)) if precisions else 0.0


def contextual_recall(retrieved_docs: List[Dict[str, Any]], relevant_ids: Set[str]) -> float:
    """
    Measures the ratio of total relevant document IDs retrieved anywhere in the candidates.
    """
    if not relevant_ids:
        return 1.0
    retrieved_set = {item.get("metadata", {}).get("document_id", "") for item in retrieved_docs}
    matched = retrieved_set.intersection(relevant_ids)
    return len(matched) / len(relevant_ids)


def evaluate_retrieval_batch(
    query_results: List[Dict[str, Any]],
    k_values: List[int] = [1, 3, 5, 10]
) -> Dict[str, float]:
    """
    Computes aggregated retrieval evaluation metrics across a test benchmark.
    Each item in query_results must contain:
      - 'retrieved_ids': List[str]
      - 'relevant_ids': Set[str]
      - 'retrieved_docs': List[Dict[str, Any]]
    """
    metrics: Dict[str, List[float]] = {
        "mrr": [],
        "contextual_precision": [],
        "contextual_recall": []
    }
    for k in k_values:
        metrics[f"precision@{k}"] = []
        metrics[f"recall@{k}"] = []
        metrics[f"hit@{k}"] = []

    for item in query_results:
        ret_ids = item["retrieved_ids"]
        rel_ids = set(item["relevant_ids"])
        ret_docs = item.get("retrieved_docs", [])

        if not rel_ids:
            continue

        metrics["mrr"].append(reciprocal_rank(ret_ids, rel_ids))
        metrics["contextual_precision"].append(contextual_precision(ret_docs, rel_ids))
        metrics["contextual_recall"].append(contextual_recall(ret_docs, rel_ids))

        for k in k_values:
            metrics[f"precision@{k}"].append(precision_at_k(ret_ids, rel_ids, k))
            metrics[f"recall@{k}"].append(recall_at_k(ret_ids, rel_ids, k))
            metrics[f"hit@{k}"].append(hit_at_k(ret_ids, rel_ids, k))

    # Return means
    return {metric_name: float(np.mean(values)) if values else 0.0 for metric_name, values in metrics.items()}
