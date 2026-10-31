"""
Embedding generation module using SentenceTransformers.
Supports batch embedding, L2 normalization for cosine similarity,
lazy model loading, and SHA-256 chunk hashing to avoid redundant re-embedding.
"""

import os
import json
import hashlib
from typing import List, Tuple, Dict, Any, Optional
import numpy as np

from app.config.settings import get_settings


class EmbeddingService:
    """Generates dense vector embeddings using SentenceTransformers with change-tracking."""

    _instance: Optional["EmbeddingService"] = None

    def __init__(self, model_name: Optional[str] = None):
        settings = get_settings()
        self.model_name = model_name or settings.EMBEDDING_MODEL_NAME
        self._model = None
        self.dimension = 384  # Standard embedding dimension for all-MiniLM-L6-v2
        self.cache_dir = settings.FAISS_INDEX_DIR
        os.makedirs(self.cache_dir, exist_ok=True)
        self.hash_cache_file = os.path.join(self.cache_dir, "chunk_hashes.json")
        self.chunk_hashes: Dict[str, str] = self._load_hash_cache()
        self._query_cache: Dict[Tuple[str, bool], np.ndarray] = {}
        self._max_query_cache = 128

    @property
    def model(self):
        """Lazy load SentenceTransformer to preserve memory."""
        if self._model is None:
            import torch
            from sentence_transformers import SentenceTransformer
            n_threads = max(1, min(4, os.cpu_count() or 1))
            torch.set_num_threads(n_threads)
            self._model = SentenceTransformer(self.model_name, device="cpu")
            if hasattr(self._model, "get_embedding_dimension"):
                self.dimension = self._model.get_embedding_dimension()
            else:
                self.dimension = self._model.get_sentence_embedding_dimension()
        return self._model

    @classmethod
    def get_instance(cls, model_name: Optional[str] = None) -> "EmbeddingService":
        """Singleton accessor to prevent reloading heavy models."""
        if cls._instance is None:
            cls._instance = cls(model_name)
        return cls._instance

    def _load_hash_cache(self) -> Dict[str, str]:
        """Loads cached SHA-256 hashes of indexed chunks."""
        if os.path.exists(self.hash_cache_file):
            try:
                with open(self.hash_cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_hash_cache(self):
        """Saves current chunk hashes to cache file."""
        with open(self.hash_cache_file, "w", encoding="utf-8") as f:
            json.dump(self.chunk_hashes, f, indent=2)

    @staticmethod
    def compute_hash(text: str) -> str:
        """Returns SHA-256 hash of a string."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def embed_texts(self, texts: List[str], batch_size: int = 32, normalize: bool = True) -> np.ndarray:
        """
        Embeds a list of texts in batches.
        Normalizes vectors to unit length if normalize=True.
        """
        if not texts:
            return np.empty((0, self.dimension), dtype=np.float32)

        import gc
        import torch
        with torch.inference_mode():
            embeddings = self.model.encode(
                texts,
                batch_size=batch_size,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=normalize
            )
        gc.collect()
        return embeddings.astype(np.float32)

    def embed_query(self, query: str, normalize: bool = True) -> np.ndarray:
        """Embeds a single query string with minimal RAM footprint and LRU query caching."""
        cache_key = (query.strip().lower(), normalize)
        if cache_key in self._query_cache:
            return self._query_cache[cache_key].copy()

        import gc
        import torch
        with torch.inference_mode():
            emb = self.model.encode(
                [query],
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=normalize
            )
        gc.collect()
        result = emb.astype(np.float32)

        if len(self._query_cache) >= self._max_query_cache:
            self._query_cache.pop(next(iter(self._query_cache)))
        self._query_cache[cache_key] = result
        return result

    def identify_changed_chunks(
        self,
        chunks: List[Any]
    ) -> Tuple[List[int], List[str]]:
        """
        Compares chunk hashes against the cache.
        Returns:
            indices_to_embed: list of chunk indices that are new or changed
            new_hashes: corresponding new hash values
        """
        indices_to_embed = []
        new_hashes = []

        for idx, chunk in enumerate(chunks):
            chunk_id = chunk.metadata.get("chunk_id", str(idx))
            content = chunk.page_content
            current_hash = self.compute_hash(content)

            if chunk_id not in self.chunk_hashes or self.chunk_hashes[chunk_id] != current_hash:
                indices_to_embed.append(idx)
                new_hashes.append(current_hash)

        return indices_to_embed, new_hashes

    def update_hash_cache(self, chunk_id: str, content_hash: str):
        """Record newly embedded chunk hash and persist."""
        self.chunk_hashes[chunk_id] = content_hash
        self._save_hash_cache()
