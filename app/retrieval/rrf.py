"""
Reciprocal Rank Fusion (RRF) Module.
Combines multiple ranked lists (e.g., Dense Vector search and Sparse BM25 search)
into a unified ranking using the formula:
    RRF_score(d) = Σ (1 / (k + rank(d)))
"""

from typing import List, Tuple, Dict, Any, Optional
from langchain_core.documents import Document
from app.config.settings import get_settings


def reciprocal_rank_fusion(
    dense_results: List[Tuple[Document, float]],
    bm25_results: List[Tuple[Document, float]],
    k: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Combines ranked results from Dense Vector search and BM25 search.

    Args:
        dense_results: List of (Document, score) sorted by dense similarity descending.
        bm25_results: List of (Document, score) sorted by BM25 score descending.
        k: Smoothing constant (default 60 from settings).

    Returns:
        List of fused result dictionaries sorted by rrf_score descending.
    """
    settings = get_settings()
    k_val = k if k is not None else settings.RRF_K

    # Map chunk key to fused accumulator
    fused_scores: Dict[str, Dict[str, Any]] = {}

    # Process Dense Search results
    for rank_idx, (doc, score) in enumerate(dense_results):
        chunk_id = doc.metadata.get("chunk_id") or f"doc_hash_{hash(doc.page_content)}"
        rrf_contribution = 1.0 / (k_val + (rank_idx + 1))

        if chunk_id not in fused_scores:
            fused_scores[chunk_id] = {
                "document": doc,
                "chunk_id": chunk_id,
                "rrf_score": 0.0,
                "dense_rank": rank_idx + 1,
                "dense_score": float(score),
                "bm25_rank": None,
                "bm25_score": None,
                "metadata": dict(doc.metadata),
                "page_content": doc.page_content
            }
        fused_scores[chunk_id]["rrf_score"] += rrf_contribution

    # Process BM25 Search results
    for rank_idx, (doc, score) in enumerate(bm25_results):
        chunk_id = doc.metadata.get("chunk_id") or f"doc_hash_{hash(doc.page_content)}"
        rrf_contribution = 1.0 / (k_val + (rank_idx + 1))

        if chunk_id not in fused_scores:
            fused_scores[chunk_id] = {
                "document": doc,
                "chunk_id": chunk_id,
                "rrf_score": 0.0,
                "dense_rank": None,
                "dense_score": None,
                "bm25_rank": rank_idx + 1,
                "bm25_score": float(score),
                "metadata": dict(doc.metadata),
                "page_content": doc.page_content
            }
        else:
            fused_scores[chunk_id]["bm25_rank"] = rank_idx + 1
            fused_scores[chunk_id]["bm25_score"] = float(score)

        fused_scores[chunk_id]["rrf_score"] += rrf_contribution

    # Sort candidates by combined RRF score in descending order
    fused_list = list(fused_scores.values())
    fused_list.sort(key=lambda item: item["rrf_score"], reverse=True)

    return fused_list
