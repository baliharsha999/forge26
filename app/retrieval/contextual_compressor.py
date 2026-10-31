"""
Contextual Compression and Extraction module.
Extracts relevant factual paragraphs while pruning irrelevant text, headers, and redundancies.
Strictly preserves numerical values, financial figures, dates, eligibility criteria, and metadata.
"""

import re
from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
from app.config.settings import get_settings


class ContextualCompressor:
    """Compresses document chunks by extracting salient facts, figures, and criteria."""

    def __init__(self):
        self.settings = get_settings()
        # Patterns for critical facts that must NEVER be compressed away
        self.critical_patterns = [
            r"₹\s*[\d,]+",
            r"rs\.?\s*[\d,]+",
            r"\b\d+\s*(?:lakh|crore|percent|%|thousand|inr|unit|units|kw|kwh|mw)\b",
            r"\b(20[12]\d|19\d\d)\b",
            r"\b(eligib|criteria|qualification|age limit|annual income|subsidy|interest rate|loan limit)\b",
            r"\b(shishu|kishore|tarun|beneficiar|process|mandat)\b"
        ]
        self.compiled_patterns = [re.compile(p, re.IGNORECASE) for p in self.critical_patterns]

    def _contains_critical_data(self, text: str) -> bool:
        """Checks if a paragraph contains key numerical values, dates, or criteria."""
        return any(pat.search(text) for pat in self.compiled_patterns)

    def _score_paragraph_relevance(self, para: str, query: str) -> float:
        """Computes relevance score of paragraph based on query tokens and factual density."""
        q_tokens = set(re.findall(r"\b\w{3,}\b", query.lower()))
        p_tokens = set(re.findall(r"\b\w{3,}\b", para.lower()))

        if not q_tokens:
            return 0.5

        overlap = len(q_tokens.intersection(p_tokens)) / len(q_tokens)
        bonus = 0.3 if self._contains_critical_data(para) else 0.0
        return min(1.0, overlap + bonus)

    def compress_chunk(self, chunk: Dict[str, Any], query: str) -> Dict[str, Any]:
        """
        Compresses a single chunk by extracting relevant paragraphs,
        removing noise while preserving crucial dates, figures, and metadata.
        """
        raw_text = chunk.get("page_content", "")
        paragraphs = [p.strip() for p in raw_text.split("\n") if len(p.strip()) > 20]

        if not paragraphs:
            return chunk

        selected_paragraphs = []
        seen_para_hashes = set()

        for para in paragraphs:
            score = self._score_paragraph_relevance(para, query)
            # Retain if relevant or contains critical government numbers/eligibility rules
            if score >= 0.15 or self._contains_critical_data(para):
                para_hash = hash(para[:80])
                if para_hash not in seen_para_hashes:
                    seen_para_hashes.add(para_hash)
                    selected_paragraphs.append(para)

        # Fallback to full text if compression was too aggressive
        compressed_text = "\n\n".join(selected_paragraphs) if selected_paragraphs else raw_text

        compressed_chunk = dict(chunk)
        compressed_chunk["original_length"] = len(raw_text)
        compressed_chunk["compressed_length"] = len(compressed_text)
        compressed_chunk["compression_ratio"] = round(len(compressed_text) / max(len(raw_text), 1), 2)
        compressed_chunk["page_content"] = compressed_text
        return compressed_chunk

    def compress_documents(
        self,
        documents: List[Dict[str, Any]],
        query: str,
        max_chunks: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Compresses a ranked list of candidate documents.
        Deduplicates identical snippets and limits to top high-density chunks.
        """
        compressed = []
        seen_texts = set()

        for doc in documents[:max_chunks]:
            c_doc = self.compress_chunk(doc, query)
            snippet_key = c_doc.get("page_content", "")[:100]
            if snippet_key not in seen_texts:
                seen_texts.add(snippet_key)
                compressed.append(c_doc)

        return compressed
