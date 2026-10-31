"""
LangChain-compatible Vector Store wrapper for FAISS HNSW.
Connects FAISSHNSWIndex with EmbeddingService for seamless retrieval.
"""

from typing import List, Tuple, Optional, Any, Dict
import numpy as np
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore
from langchain_core.embeddings import Embeddings

from app.retrieval.hnsw_index import FAISSHNSWIndex
from app.ingestion.embeddings import EmbeddingService
from app.config.settings import get_settings


class FAISSHNSWVectorStore(VectorStore):
    """LangChain VectorStore implementation powered by native faiss.IndexHNSWFlat."""

    def __init__(
        self,
        hnsw_index: Optional[FAISSHNSWIndex] = None,
        embedding_service: Optional[EmbeddingService] = None,
    ):
        self.embedding_service = embedding_service or EmbeddingService.get_instance()
        self.hnsw_index = hnsw_index or FAISSHNSWIndex(dimension=self.embedding_service.dimension)

        # Attempt to load persisted index
        if not self.hnsw_index.total_vectors:
            self.hnsw_index.load()

    @classmethod
    def from_texts(
        cls,
        texts: List[str],
        embedding: Any = None,
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any
    ) -> "FAISSHNSWVectorStore":
        """Create vector store instance from raw texts and metadata."""
        docs = [
            Document(page_content=t, metadata=metadatas[i] if metadatas else {})
            for i, t in enumerate(texts)
        ]
        store = cls()
        store.add_documents(docs)
        return store

    def add_texts(
        self,
        texts: List[str],
        metadatas: Optional[List[dict]] = None,
        **kwargs: Any
    ) -> List[str]:
        """Add texts to the HNSW vector store."""
        docs = [
            Document(page_content=t, metadata=metadatas[i] if metadatas else {})
            for i, t in enumerate(texts)
        ]
        return self.add_documents(docs)

    def add_documents(self, documents: List[Document], **kwargs: Any) -> List[str]:
        """Embeds and indexes documents in HNSW."""
        if not documents:
            return []

        texts = [doc.page_content for doc in documents]
        embeddings = self.embedding_service.embed_texts(texts)
        self.hnsw_index.add_documents(documents, embeddings)
        self.hnsw_index.save()

        # Update hash cache
        for doc in documents:
            chunk_id = doc.metadata.get("chunk_id", "")
            if chunk_id:
                h = self.embedding_service.compute_hash(doc.page_content)
                self.embedding_service.update_hash_cache(chunk_id, h)

        return [doc.metadata.get("chunk_id", str(i)) for i, doc in enumerate(documents)]

    def similarity_search_with_score(
        self,
        query: str,
        k: int = 10,
        **kwargs: Any
    ) -> List[Tuple[Document, float]]:
        """Dense HNSW vector search returning (Document, similarity_score)."""
        query_vec = self.embedding_service.embed_query(query)
        return self.hnsw_index.similarity_search_with_score(query_vec, top_k=k)

    def similarity_search(
        self,
        query: str,
        k: int = 10,
        **kwargs: Any
    ) -> List[Document]:
        """Dense HNSW vector search returning only Documents."""
        results = self.similarity_search_with_score(query, k=k)
        return [doc for doc, _ in results]

    def similarity_search_by_vector(
        self,
        embedding: List[float],
        k: int = 10,
        **kwargs: Any
    ) -> List[Document]:
        """Search HNSW using precomputed vector."""
        vec = np.array([embedding], dtype=np.float32)
        results = self.hnsw_index.similarity_search_with_score(vec, top_k=k)
        return [doc for doc, _ in results]

    @property
    def embeddings(self) -> Optional[Embeddings]:
        """Return embedding function if needed by LangChain."""
        return None
