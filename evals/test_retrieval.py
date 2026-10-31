"""
Retrieval Evaluation Script.
Evaluates Precision@K, Recall@K, MRR, Hit@K, Contextual Precision, and Contextual Recall.
Compares Dense FAISS HNSW vs. Sparse BM25 vs. Hybrid RRF.
"""

import os
import sys
import json
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.retrieval.faiss_store import FAISSHNSWVectorStore
from app.retrieval.bm25_retriever import GovernmentBM25Retriever
from app.retrieval.rrf import reciprocal_rank_fusion
from app.evaluation.retrieval_eval import evaluate_retrieval_batch


def run_retrieval_eval():
    print("=" * 60)
    print("RUNNING RETRIEVAL EVALUATION BENCHMARK")
    print("=" * 60)

    # Load test dataset
    dataset_path = os.path.join("evals", "test_dataset.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    # Filter in-domain test cases
    test_cases = [d for d in dataset if d.get("is_in_domain", True)]
    print(f"Loaded {len(test_cases)} in-domain government test queries.")

    vector_store = FAISSHNSWVectorStore()
    bm25 = GovernmentBM25Retriever()

    dense_results = []
    bm25_results = []
    hybrid_rrf_results = []

    for item in test_cases:
        query = item["query"]
        relevant_ids = set(item["expected_document_ids"])

        # 1. Dense FAISS HNSW
        d_docs = vector_store.similarity_search_with_score(query, k=10)
        d_ids = [doc.metadata.get("document_id") for doc, _ in d_docs]
        dense_results.append({
            "retrieved_ids": d_ids,
            "relevant_ids": relevant_ids,
            "retrieved_docs": [{"metadata": doc.metadata} for doc, _ in d_docs]
        })

        # 2. Sparse BM25
        b_docs = bm25.search_with_score(query, top_k=10)
        b_ids = [doc.metadata.get("document_id") for doc, _ in b_docs]
        bm25_results.append({
            "retrieved_ids": b_ids,
            "relevant_ids": relevant_ids,
            "retrieved_docs": [{"metadata": doc.metadata} for doc, _ in b_docs]
        })

        # 3. Hybrid RRF
        fused = reciprocal_rank_fusion(d_docs, b_docs, k=60)
        fused_ids = [item["metadata"].get("document_id") for item in fused]
        hybrid_rrf_results.append({
            "retrieved_ids": fused_ids,
            "relevant_ids": relevant_ids,
            "retrieved_docs": fused
        })

    # Compute metrics
    dense_metrics = evaluate_retrieval_batch(dense_results)
    bm25_metrics = evaluate_retrieval_batch(bm25_results)
    hybrid_metrics = evaluate_retrieval_batch(hybrid_rrf_results)

    print("\n--- 1. Dense Vector (FAISS HNSW) Metrics ---")
    for k, v in dense_metrics.items():
        print(f"  {k:24s}: {v:.4f}")

    print("\n--- 2. Sparse Keyword (BM25) Metrics ---")
    for k, v in bm25_metrics.items():
        print(f"  {k:24s}: {v:.4f}")

    print("\n--- 3. Hybrid Search + RRF Metrics ---")
    for k, v in hybrid_metrics.items():
        print(f"  {k:24s}: {v:.4f}")

    # Summary assertion for automated test harnesses
    assert hybrid_metrics["hit@5"] >= 0.8, "Hybrid RRF Hit@5 must be >= 0.8"
    assert hybrid_metrics["mrr"] > 0.5, "Hybrid RRF MRR must be > 0.5"
    print("\n[SUCCESS] Retrieval evaluation completed successfully!")
    return hybrid_metrics


if __name__ == "__main__":
    run_retrieval_eval()
