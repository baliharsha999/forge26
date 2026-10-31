"""
Hybrid Search Engine executing Dense FAISS HNSW and Sparse BM25 retrieval in parallel.
Integrates directly with Reciprocal Rank Fusion.
"""

from typing import List, Tuple, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
from langchain_core.documents import Document

from app.retrieval.faiss_store import FAISSHNSWVectorStore
from app.retrieval.bm25_retriever import GovernmentBM25Retriever
from app.retrieval.rrf import reciprocal_rank_fusion
from app.config.settings import get_settings


class HybridSearchEngine:
    """Executes Dense Vector search and Sparse BM25 search in parallel threads."""

    def __init__(
        self,
        vector_store: Optional[FAISSHNSWVectorStore] = None,
        bm25_retriever: Optional[GovernmentBM25Retriever] = None,
    ):
        settings = get_settings()
        self.vector_store = vector_store or FAISSHNSWVectorStore()
        self.bm25_retriever = bm25_retriever or GovernmentBM25Retriever()
        self.dense_top_k = settings.VECTOR_TOP_K
        self.bm25_top_k = settings.BM25_TOP_K
        self.rrf_k = settings.RRF_K

    def _dense_search(self, query: str, top_k: int) -> List[Tuple[Document, float]]:
        """Worker function for dense vector similarity search."""
        try:
            return self.vector_store.similarity_search_with_score(query, k=top_k)
        except Exception as e:
            print(f"[HybridSearch] Error in dense retrieval: {e}")
            return []

    def _sparse_search(self, query: str, top_k: int) -> List[Tuple[Document, float]]:
        """Worker function for BM25 keyword search."""
        try:
            return self.bm25_retriever.search_with_score(query, top_k=top_k)
        except Exception as e:
            print(f"[HybridSearch] Error in BM25 retrieval: {e}")
            return []

    def search_parallel(
        self,
        query: str,
        dense_k: Optional[int] = None,
        bm25_k: Optional[int] = None
    ) -> Tuple[List[Tuple[Document, float]], List[Tuple[Document, float]]]:
        """
        Executes dense and sparse retrieval in parallel threads.
        Returns:
            (dense_results, bm25_results)
        """
        k_dense = dense_k or self.dense_top_k
        k_bm25 = bm25_k or self.bm25_top_k

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_dense = executor.submit(self._dense_search, query, k_dense)
            future_sparse = executor.submit(self._sparse_search, query, k_bm25)

            dense_res = future_dense.result()
            sparse_res = future_sparse.result()

        return dense_res, sparse_res

    def search_and_fuse(
        self,
        query: str,
        dense_k: Optional[int] = None,
        bm25_k: Optional[int] = None,
        rrf_k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes parallel hybrid search and combines rankings using Reciprocal Rank Fusion.
        """
        dense_res, sparse_res = self.search_parallel(query, dense_k, bm25_k)
        fused = reciprocal_rank_fusion(dense_res, sparse_res, k=rrf_k or self.rrf_k)
        return fused
