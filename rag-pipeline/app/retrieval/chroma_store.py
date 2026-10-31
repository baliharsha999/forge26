"""
ChromaDB Vector Store Implementation.
Provides persistent vector storage, deduplication, cosine similarity search,
and resumable document indexing for Render deployments.
"""

import os
import logging
from typing import List, Tuple, Optional, Any, Dict
import numpy as np
from langchain_core.documents import Document

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class ChromaVectorStore:
    """
    ChromaDB-backed vector store for Government Information documents.
    Compatible with the FAISSHNSWIndex interface.
    """

    _instance: Optional["ChromaVectorStore"] = None

    def __init__(self, persist_directory: Optional[str] = None, collection_name: str = "government_schemes"):
        settings = get_settings()
        self.persist_directory = persist_directory or os.path.join("data", "chroma_db")
        self.collection_name = collection_name
        os.makedirs(self.persist_directory, exist_ok=True)
        self._client = None
        self._collection = None

    @property
    def client(self):
        """Lazy load ChromaDB client to minimize startup RAM."""
        if self._client is None:
            import chromadb
            self._client = chromadb.PersistentClient(path=self.persist_directory)
        return self._client

    @property
    def collection(self):
        """Retrieve or create Chroma collection."""
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        return self._collection

    @property
    def total_vectors(self) -> int:
        """Returns total vector count in collection."""
        try:
            return self.collection.count()
        except Exception:
            return 0

    @classmethod
    def get_instance(cls) -> "ChromaVectorStore":
        """Singleton pattern to share a single connection in memory."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def add_documents(
        self,
        documents: List[Document],
        embeddings: np.ndarray
    ) -> List[str]:
        """
        Adds documents and embeddings to ChromaDB with automatic deduplication.
        Skips documents whose chunk IDs or hashes already exist in the collection.
        """
        if not documents:
            return []

        ids: List[str] = []
        texts: List[str] = []
        metadatas: List[Dict[str, Any]] = []
        embs_list: List[List[float]] = []

        # Get existing IDs in collection to enable resumable indexing
        try:
            existing_count = self.collection.count()
            existing_ids = set()
            if existing_count > 0:
                existing_data = self.collection.get(include=[])
                existing_ids = set(existing_data.get("ids", []))
        except Exception as e:
            logger.warning(f"Failed to fetch existing Chroma IDs: {e}")
            existing_ids = set()

        for idx, doc in enumerate(documents):
            chunk_id = doc.metadata.get("chunk_id")
            if not chunk_id:
                # Generate stable ID from doc_id and index
                doc_id = doc.metadata.get("document_id", "doc")
                chunk_id = f"{doc_id}_chunk_{idx}"

            # Deduplication: skip if already present in collection
            if chunk_id in existing_ids:
                continue

            ids.append(str(chunk_id))
            texts.append(doc.page_content)
            # Flatten metadata for ChromaDB compatibility (primitive values only)
            clean_meta = {}
            for k, v in doc.metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    clean_meta[k] = v
                elif v is None:
                    clean_meta[k] = ""
                else:
                    clean_meta[k] = str(v)
            metadatas.append(clean_meta)

            if idx < len(embeddings):
                embs_list.append(embeddings[idx].tolist())

        if ids and embs_list:
            # Batch upsert to ChromaDB
            batch_size = 50
            for i in range(0, len(ids), batch_size):
                b_ids = ids[i:i + batch_size]
                b_texts = texts[i:i + batch_size]
                b_meta = metadatas[i:i + batch_size]
                b_embs = embs_list[i:i + batch_size]
                self.collection.upsert(
                    ids=b_ids,
                    documents=b_texts,
                    metadatas=b_meta,
                    embeddings=b_embs
                )
            logger.info(f"Added {len(ids)} new chunks to ChromaDB (skipped {len(documents) - len(ids)} duplicates).")

        return ids

    def similarity_search_with_score(
        self,
        query_embedding: np.ndarray,
        top_k: int = 10
    ) -> List[Tuple[Document, float]]:
        """
        Performs approximate nearest neighbor search using query vector.
        Returns list of (Document, cosine_similarity_score).
        """
        if self.total_vectors == 0:
            return []

        q_list = query_embedding[0].tolist() if query_embedding.ndim > 1 else query_embedding.tolist()
        try:
            results = self.collection.query(
                query_embeddings=[q_list],
                n_results=min(top_k, self.total_vectors),
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            logger.error(f"Chroma similarity search error: {e}")
            return []

        docs_scores: List[Tuple[Document, float]] = []
        if not results or not results.get("documents"):
            return docs_scores

        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0]

        for text, meta, dist in zip(docs, metas, distances):
            # Chroma returns cosine distance (0 = identical, 2 = opposite)
            # Convert cosine distance to cosine similarity: sim = 1.0 - dist
            sim = max(0.0, 1.0 - float(dist))
            doc = Document(page_content=text, metadata=meta or {})
            docs_scores.append((doc, sim))

        return docs_scores

    def save(self, *args, **kwargs):
        """PersistentClient auto-persists to disk."""
        pass

    def load(self, *args, **kwargs):
        """PersistentClient auto-loads from disk."""
        pass
