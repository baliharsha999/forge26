"""
Sparse BM25 retriever for exact keyword matching, scheme titles, and terminology.
Uses rank_bm25 BM25Okapi with preprocessing and persistence.
"""

import os
import re
import pickle
import logging
import unicodedata
from typing import List, Tuple, Optional, Dict, Any
from rank_bm25 import BM25Okapi
from langchain_core.documents import Document
from app.config.settings import get_settings

logger = logging.getLogger(__name__)


def language_aware_tokenizer(text: str) -> List[str]:
    """
    Language-aware tokenizer supporting Indic scripts, Latin/English, numbers,
    and government scheme terminology.
    - Applies Unicode NFC normalization.
    - Handles Indic punctuation (danda '।', double danda '॥').
    - Preserves combining characters / matras across Indic languages.
    - Preserves numbers, scheme names, hyphenated terms (e.g. 'pm-kisan' -> 'pm', 'kisan', 'pmkisan').
    """
    if not text:
        return []

    norm = unicodedata.normalize("NFC", text.lower())

    # Replace punctuation, sentence terminators, and formatting marks with spaces
    # Keeps Indic characters, Latin letters, digits, and hyphens/underscores initially
    cleaned = re.sub(r'[\r\n\t।,;:?!\(\)\[\]\{\}\"\'`*#\\/<>+=|~^@$%&]+', ' ', norm)

    raw_tokens = [t.strip() for t in cleaned.split() if t.strip()]
    tokens: List[str] = []

    for t in raw_tokens:
        if '-' in t:
            parts = [p.strip() for p in t.split('-') if p.strip()]
            tokens.extend(parts)
            joined = "".join(parts)
            if joined and joined not in tokens:
                tokens.append(joined)
        elif '_' in t:
            parts = [p.strip() for p in t.split('_') if p.strip()]
            tokens.extend(parts)
            joined = "".join(parts)
            if joined and joined not in tokens:
                tokens.append(joined)
        else:
            cleaned_t = t.strip('.-_')
            if cleaned_t and len(cleaned_t) > 0:
                tokens.append(cleaned_t)

    return tokens


# Alias for backward compatibility
default_tokenizer = language_aware_tokenizer


class GovernmentBM25Retriever:
    """Sparse retriever for government terminology, scheme titles, and exact keywords."""

    def __init__(
        self,
        documents: Optional[List[Document]] = None,
        top_k: Optional[int] = None,
        index_dir: Optional[str] = None
    ):
        settings = get_settings()
        self.top_k = top_k or settings.BM25_TOP_K
        self.index_dir = index_dir or settings.FAISS_INDEX_DIR
        os.makedirs(self.index_dir, exist_ok=True)
        self.persistence_file = os.path.join(self.index_dir, "bm25_store.pkl")

        self.documents: List[Document] = []
        self.corpus_tokens: List[List[str]] = []
        self.bm25: Optional[BM25Okapi] = None

        if documents:
            self.index_documents(documents)
        else:
            self.load()

    def index_documents(self, documents: List[Document]):
        """Builds BM25 index over provided LangChain documents."""
        if not documents:
            return

        self.documents = list(documents)
        # Prepend title and department to chunk text to boost keyword matching for schemes
        self.corpus_tokens = []
        for doc in self.documents:
            title = doc.metadata.get("title", "")
            dept = doc.metadata.get("department", "")
            rich_text = f"{title} {title} {dept} {doc.page_content}"
            tokens = default_tokenizer(rich_text)
            self.corpus_tokens.append(tokens)

        self.bm25 = BM25Okapi(self.corpus_tokens)
        self.save()
        logger.info(f"Built and persisted BM25 index over {len(self.documents)} chunks.")

    def search_with_score(self, query: str, top_k: Optional[int] = None) -> List[Tuple[Document, float]]:
        """
        Retrieves top_k documents with BM25 scores.
        """
        k = top_k or self.top_k
        if not self.bm25 or not self.documents:
            return []

        query_tokens = default_tokenizer(query)
        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)
        # Get top indices
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]

        results: List[Tuple[Document, float]] = []
        for idx in top_indices:
            score = float(scores[idx])
            if score > 0.0:  # Only return documents that had at least one matching token
                results.append((self.documents[idx], score))

        return results

    def search(self, query: str, top_k: Optional[int] = None) -> List[Document]:
        """Returns only retrieved Documents."""
        scored = self.search_with_score(query, top_k=top_k)
        return [doc for doc, _ in scored]

    def save(self):
        """Persists the BM25 corpus and documents."""
        try:
            with open(self.persistence_file, "wb") as f:
                pickle.dump({
                    "documents": self.documents,
                    "corpus_tokens": self.corpus_tokens
                }, f)
        except Exception as e:
            logger.error(f"Failed to persist BM25 store: {e}")

    def load(self) -> bool:
        """Loads BM25 store from disk."""
        if not os.path.exists(self.persistence_file):
            return False

        try:
            with open(self.persistence_file, "rb") as f:
                data = pickle.load(f)
            self.documents = data.get("documents", [])
            self.corpus_tokens = data.get("corpus_tokens", [])
            if self.corpus_tokens:
                self.bm25 = BM25Okapi(self.corpus_tokens)
            logger.info(f"Loaded BM25 index with {len(self.documents)} documents.")
            return True
        except Exception as e:
            logger.error(f"Failed to load BM25 store: {e}")
            return False
