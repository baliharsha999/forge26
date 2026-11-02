"""
FAISS HNSW Index implementation using faiss.IndexHNSWFlat.
Provides fast approximate nearest neighbor search with full index persistence,
efSearch / efConstruction tuning, and metadata-vector ID synchronization.
"""

import os
import json
import logging
from typing import List, Dict, Tuple, Optional, Any
import numpy as np
import faiss
from langchain_core.documents import Document
from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class FAISSHNSWIndex:
    """FAISS Vector Index utilizing IndexHNSWFlat for high-recall approximate nearest neighbor search."""

    def __init__(
        self,
        dimension: int = 384,
        m: Optional[int] = None,
        ef_construction: Optional[int] = None,
        ef_search: Optional[int] = None,
        index_dir: Optional[str] = None,
    ):
        settings = get_settings()
        self.dimension = dimension
        self.m = m or settings.HNSW_M
        self.ef_construction = ef_construction or settings.HNSW_EF_CONSTRUCTION
        self.ef_search = ef_search or settings.HNSW_EF_SEARCH
        self.index_dir = index_dir or settings.FAISS_INDEX_DIR

        os.makedirs(self.index_dir, exist_ok=True)
        self.index_file = os.path.join(self.index_dir, "hnsw_index.bin")
        self.metadata_file = os.path.join(self.index_dir, "metadata_store.json")

        self.index: faiss.IndexHNSWFlat = self._create_empty_index()
        self.doc_store: Dict[int, Dict[str, Any]] = {}  # id -> {page_content, metadata}
        self.chunk_id_to_int_id: Dict[str, int] = {}
        self.next_id: int = 0

        # Auto-load existing index if available
        if os.path.exists(self.index_file) and os.path.exists(self.metadata_file):
            self.load()

    def _create_empty_index(self) -> faiss.IndexHNSWFlat:
        """Instantiates an unpopulated faiss.IndexHNSWFlat with METRIC_INNER_PRODUCT (cosine)."""
        idx = faiss.IndexHNSWFlat(self.dimension, self.m, faiss.METRIC_INNER_PRODUCT)
        idx.hnsw.efConstruction = self.ef_construction
        idx.hnsw.efSearch = self.ef_search
        return idx

    def add_documents(
        self,
        documents: List[Document],
        embeddings: np.ndarray
    ) -> List[int]:
        """
        Adds vectors and synchronized LangChain documents to the HNSW index.
        """
        if len(documents) == 0:
            return []

        if len(documents) != len(embeddings):
            raise ValueError(
                f"Count mismatch between documents ({len(documents)}) and embeddings ({len(embeddings)})"
            )

        # Ensure embeddings are normalized float32
        vecs = np.ascontiguousarray(embeddings, dtype=np.float32)
        faiss.normalize_L2(vecs)

        new_docs = []
        new_vecs = []
        assigned_ids = []

        for i, doc in enumerate(documents):
            chunk_id = doc.metadata.get("chunk_id", f"chunk_{self.next_id}")

            # Chunk already indexed: keep its vector when the text is unchanged.
            if chunk_id in self.chunk_id_to_int_id:
                existing_int_id = self.chunk_id_to_int_id[chunk_id]
                existing = self.doc_store.get(existing_int_id)

                if existing is not None and existing.get("page_content") == doc.page_content:
                    existing["metadata"] = doc.metadata
                    assigned_ids.append(existing_int_id)
                    continue

                # Text changed: the stored vector no longer represents this chunk.
                # Retire it (unmapped ids are skipped on search) and index the new
                # text as a fresh vector instead of leaving text/vector mismatched.
                self.doc_store.pop(existing_int_id, None)
                self.chunk_id_to_int_id.pop(chunk_id, None)

            current_id = self.next_id
            self.doc_store[current_id] = {
                "page_content": doc.page_content,
                "metadata": doc.metadata
            }
            self.chunk_id_to_int_id[chunk_id] = current_id
            assigned_ids.append(current_id)
            self.next_id += 1
            new_docs.append(doc)
            new_vecs.append(vecs[i])

        if new_vecs:
            vecs_to_add = np.ascontiguousarray(new_vecs, dtype=np.float32)
            self.index.add(vecs_to_add)

        return assigned_ids

    def similarity_search_with_score(
        self,
        query_vector: np.ndarray,
        top_k: int = 10
    ) -> List[Tuple[Document, float]]:
        """
        Executes HNSW similarity search using query vector.
        Returns list of (Document, cosine_similarity_score).
        """
        if self.index.ntotal == 0:
            return []

        # Make sure query vector is normalized float32 with shape (1, dimension)
        q = np.ascontiguousarray(query_vector, dtype=np.float32)
        if q.ndim == 1:
            q = np.expand_dims(q, axis=0)
        faiss.normalize_L2(q)

        # Set runtime efSearch
        self.index.hnsw.efSearch = max(self.ef_search, top_k * 2)

        actual_k = min(top_k, self.index.ntotal)
        distances, indices = self.index.search(q, actual_k)

        results: List[Tuple[Document, float]] = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            doc_data = self.doc_store.get(int(idx))
            if doc_data:
                doc = Document(
                    page_content=doc_data["page_content"],
                    metadata=dict(doc_data["metadata"])
                )
                results.append((doc, float(dist)))

        return results

    def save(self, index_dir: Optional[str] = None):
        """Persists the FAISS HNSW binary index and metadata JSON to disk."""
        save_dir = index_dir or self.index_dir
        os.makedirs(save_dir, exist_ok=True)

        idx_file = os.path.join(save_dir, "hnsw_index.bin")
        meta_file = os.path.join(save_dir, "metadata_store.json")

        # Convert int keys to str for JSON serialization
        payload = {
            "dimension": self.dimension,
            "m": self.m,
            "ef_construction": self.ef_construction,
            "ef_search": self.ef_search,
            "next_id": self.next_id,
            "doc_store": {str(k): v for k, v in self.doc_store.items()},
            "chunk_id_to_int_id": self.chunk_id_to_int_id
        }

        try:
            faiss.write_index(self.index, idx_file)
            with open(meta_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except OSError as e:
            # Ephemeral/read-only disks: keep serving from the in-memory index.
            logger.warning(f"Could not persist FAISS index to {save_dir}: {e}")
            return False

        logger.info(f"Successfully persisted FAISS HNSW index with {self.index.ntotal} vectors to {save_dir}")
        return True

    def load(self, index_dir: Optional[str] = None) -> bool:
        """Loads FAISS HNSW index and metadata store from disk."""
        load_dir = index_dir or self.index_dir
        idx_file = os.path.join(load_dir, "hnsw_index.bin")
        meta_file = os.path.join(load_dir, "metadata_store.json")

        if not (os.path.exists(idx_file) and os.path.exists(meta_file)):
            return False

        try:
            self.index = faiss.read_index(idx_file)
            # Re-apply runtime efSearch
            self.index.hnsw.efSearch = self.ef_search

            with open(meta_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.dimension = data.get("dimension", self.dimension)
            self.m = data.get("m", self.m)
            self.ef_construction = data.get("ef_construction", self.ef_construction)
            self.ef_search = data.get("ef_search", self.ef_search)
            self.next_id = data.get("next_id", 0)
            self.doc_store = {int(k): v for k, v in data.get("doc_store", {}).items()}
            self.chunk_id_to_int_id = data.get("chunk_id_to_int_id", {})

            logger.info(f"Loaded existing FAISS HNSW index with {self.index.ntotal} vectors from {load_dir}")
            return True
        except Exception as e:
            logger.error(f"Failed to load FAISS index from {load_dir}: {e}")
            return False

    def rebuild(self, documents: List[Document], embeddings: np.ndarray):
        """Rebuilds the HNSW index from scratch."""
        self.index = self._create_empty_index()
        self.doc_store.clear()
        self.chunk_id_to_int_id.clear()
        self.next_id = 0
        self.add_documents(documents, embeddings)
        self.save()

    @property
    def total_vectors(self) -> int:
        """Returns the total number of indexed vectors."""
        return self.index.ntotal if self.index else 0

    def has_document_chunks(self, document_id: str) -> bool:
        """Returns True if there is at least one indexed chunk belonging to document_id."""
        for doc_data in self.doc_store.values():
            if doc_data.get("metadata", {}).get("document_id") == document_id:
                return True
        return False

    def get_document_chunk_count(self, document_id: str) -> int:
        """Counts how many indexed chunks belong to document_id."""
        return sum(
            1 for doc_data in self.doc_store.values()
            if doc_data.get("metadata", {}).get("document_id") == document_id
        )

