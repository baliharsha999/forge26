"""
Reranking Evaluation Benchmark.
Measures MRR before and after Cross-Encoder reranking, ranking improvements, and NDCG@K.
"""

import os
import sys
import json
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.retrieval.hybrid_search import HybridSearchEngine
from app.retrieval.reranker import GovernmentReranker
from app.evaluation.retrieval_eval import reciprocal_rank


def ndcg_at_k(retrieved_ids: list, relevant_ids: set, k: int = 5) -> float:
    """Calculates Normalized Discounted Cumulative Gain at rank K."""
    top_k = retrieved_ids[:k]
    dcg = 0.0
    for idx, doc_id in enumerate(top_k, start=1):
        rel = 1.0 if doc_id in relevant_ids else 0.0
        dcg += rel / np.log2(idx + 1)

    # Ideal DCG (all relevant documents ranked at the top)
    ideal_count = min(len(relevant_ids), k)
    idcg = sum(1.0 / np.log2(idx + 1) for idx in range(1, ideal_count + 1))
    return (dcg / idcg) if idcg > 0 else 0.0


def run_reranking_eval():
    print("=" * 60)
    print("RUNNING CROSS-ENCODER RERANKING EVALUATION BENCHMARK")
    print("=" * 60)

    dataset_path = os.path.join("evals", "test_dataset.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    test_cases = [d for d in dataset if d.get("is_in_domain", True)]
    hybrid_search = HybridSearchEngine()
    reranker = GovernmentReranker.get_instance()

    mrr_before_list = []
    mrr_after_list = []
    ndcg_list = []
    improved_count = 0
    total_evaluated = len(test_cases)

    for item in test_cases:
        query = item["query"]
        relevant_ids = set(item["expected_document_ids"])

        # 1. RRF ranking before cross-encoder
        fused = hybrid_search.search_and_fuse(query, dense_k=10, bm25_k=10)
        before_ids = [c["metadata"].get("document_id") for c in fused]
        mrr_before = reciprocal_rank(before_ids, relevant_ids)
        mrr_before_list.append(mrr_before)

        # 2. Cross-Encoder reranking
        reranked = reranker.rerank(query, fused, input_top_k=20, final_top_k=5)
        after_ids = [c["metadata"].get("document_id") for c in reranked]
        mrr_after = reciprocal_rank(after_ids, relevant_ids)
        mrr_after_list.append(mrr_after)

        # 3. NDCG@5
        ndcg = ndcg_at_k(after_ids, relevant_ids, k=5)
        ndcg_list.append(ndcg)

        if mrr_after >= mrr_before:
            improved_count += 1

        print(f"Query: {query[:50]}...")
        print(f"  MRR Before (RRF): {mrr_before:.3f} | MRR After (CrossEncoder): {mrr_after:.3f} | NDCG@5: {ndcg:.3f}")

    avg_mrr_before = float(np.mean(mrr_before_list))
    avg_mrr_after = float(np.mean(mrr_after_list))
    avg_ndcg = float(np.mean(ndcg_list))
    improvement_rate = (improved_count / total_evaluated) * 100.0

    print("\n" + "-" * 50)
    print("--- Reranking Benchmark Summary ---")
    print(f"  MRR Before Reranking (RRF)    : {avg_mrr_before:.4f}")
    print(f"  MRR After Reranking (CrossEnc): {avg_mrr_after:.4f}")
    print(f"  NDCG@5 (Normalized Gain)      : {avg_ndcg:.4f}")
    print(f"  Ranking Maintenance/Gain Rate : {improvement_rate:.1f}%")

    assert avg_mrr_after >= 0.75, "Reranked MRR must maintain high performance (>= 0.75)."
    assert avg_ndcg > 0.6, "NDCG@5 should be > 0.6 on verified documents."
    print("\n[SUCCESS] Reranking evaluation passed successfully!")
    return {
        "mrr_before": avg_mrr_before,
        "mrr_after": avg_mrr_after,
        "ndcg@5": avg_ndcg,
        "improvement_rate": improvement_rate
    }


if __name__ == "__main__":
    run_reranking_eval()
