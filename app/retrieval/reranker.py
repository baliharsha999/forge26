"""
Cross-Encoder Reranking module with Cross-Lingual support.
Re-scores RRF candidate chunks using Cross-Encoder with dual-query evaluation
(original query + translated English query) and embedding cosine alignment fallback.
"""

from typing import List, Dict, Any, Optional
import logging
import numpy as np

from app.config.settings import get_settings

logger = logging.getLogger(__name__)


class GovernmentReranker:
    """Reranks candidate document chunks against user query using a Cross-Encoder."""

    _instance: Optional["GovernmentReranker"] = None

    def __init__(self, model_name: Optional[str] = None):
        settings = get_settings()
        self.model_name = model_name or settings.RERANKING_MODEL_NAME
        self._model = None
        self.default_input_k = settings.RERANK_INPUT_TOP_K
        self.default_final_k = settings.FINAL_TOP_K

    @property
    def model(self):
        """Lazy load CrossEncoder to preserve memory."""
        if self._model is None:
            import torch
            from sentence_transformers import CrossEncoder
            torch.set_num_threads(1)
            self._model = CrossEncoder(self.model_name, device="cpu")
        return self._model

    @classmethod
    def get_instance(cls, model_name: Optional[str] = None) -> "GovernmentReranker":
        """Singleton accessor for cross-encoder model."""
        if cls._instance is None:
            cls._instance = cls(model_name)
        return cls._instance

    def _fallback_embedding_rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        translated_query: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fast, memory-efficient fallback scoring using batch embedding alignment and RRF scores."""
        if not candidates:
            return []
        try:
            from app.ingestion.embeddings import EmbeddingService
            service = EmbeddingService.get_instance()

            q_emb = service.embed_query(query, normalize=True)
            t_emb = service.embed_query(translated_query, normalize=True) if translated_query else None

            snippet_texts = [item.get("page_content", "")[:350] for item in candidates]
            candidate_embs = service.embed_texts(snippet_texts, batch_size=max(1, len(snippet_texts)), normalize=True)

            sims_orig = np.dot(candidate_embs, q_emb.T).flatten()
            sims_trans = np.dot(candidate_embs, t_emb.T).flatten() if t_emb is not None else np.zeros_like(sims_orig)

            for idx, item in enumerate(candidates):
                sim_orig = float(sims_orig[idx])
                sim_trans = float(sims_trans[idx]) if t_emb is not None else -1.0
                best_sim = max(sim_orig, sim_trans)
                rrf_score = item.get("score", 0.0)
                combined = 0.7 * best_sim + 0.3 * min(1.0, rrf_score * 30.0)
                item["rerank_score"] = float(combined)
                item["rerank_probability"] = float(1.0 / (1.0 + np.exp(-best_sim * 2.0)))
        except Exception as e:
            logger.warning(f"Fallback embedding rerank failed: {e}")
            for item in candidates:
                item["rerank_score"] = item.get("score", item.get("rrf_score", 0.0))
                item["rerank_probability"] = 0.5
        return sorted(candidates, key=lambda x: x.get("rerank_score", 0.0), reverse=True)

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        translated_query: Optional[str] = None,
        input_top_k: Optional[int] = None,
        final_top_k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Reranks RRF candidates using cross-encoder relevance scores.
        Supports cross-lingual evaluation: if translated_query is provided,
        evaluates pairs with both query and translated_query, selecting the max score.
        """
        if not candidates:
            return []

        settings = get_settings()
        k_in = input_top_k or self.default_input_k
        k_out = final_top_k or self.default_final_k

        top_candidates = candidates[:k_in]

        # Memory optimization for Render Free 512MB Tier
        if settings.LOW_MEMORY_MODE:
            logger.info("[Reranker] LOW_MEMORY_MODE enabled: Preserving 512MB RAM by utilizing embedding similarity alignment.")
            return self._fallback_embedding_rerank(query, top_candidates[:k_out], translated_query)

        try:
            pairs = []
            for item in top_candidates:
                title = item.get("metadata", {}).get("title", "")
                content = item.get("page_content", "")
                text = f"Title: {title}\n{content}" if title else content
                pairs.append((query, text))

            scores = self.model.predict(pairs)
            if isinstance(scores, (float, int)):
                scores = [scores]

            # If translated_query is provided and distinct from query, also evaluate against it
            if translated_query and translated_query.strip().lower() != query.strip().lower():
                pairs_trans = []
                for item in top_candidates:
                    title = item.get("metadata", {}).get("title", "")
                    content = item.get("page_content", "")
                    text = f"Title: {title}\n{content}" if title else content
                    pairs_trans.append((translated_query, text))

                trans_scores = self.model.predict(pairs_trans)
                if isinstance(trans_scores, (float, int)):
                    trans_scores = [trans_scores]

                # Combine scores: max of original and translated query score
                final_scores = [
                    max(float(s_orig), float(s_trans))
                    for s_orig, s_trans in zip(scores, trans_scores)
                ]
            else:
                final_scores = [float(s) for s in scores]

            for idx, item in enumerate(top_candidates):
                raw_score = final_scores[idx]
                prob_score = float(1.0 / (1.0 + np.exp(-raw_score)))
                item["rerank_score"] = raw_score
                item["rerank_probability"] = prob_score

        except Exception as e:
            logger.warning(f"Cross-encoder rerank failed, using embedding alignment fallback: {e}")
            top_candidates = self._fallback_embedding_rerank(query, top_candidates, translated_query)

        reranked = sorted(top_candidates, key=lambda x: x.get("rerank_score", 0.0), reverse=True)
        return reranked[:k_out]
