"""
Document processor using LangChain RecursiveCharacterTextSplitter.
Chunks documents while strictly maintaining document metadata across all chunks.
"""

from typing import List, Optional
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config.settings import get_settings


class GovernmentDocumentProcessor:
    """Processes and splits clean government documents into retrieval chunks."""

    def __init__(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        settings = get_settings()
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=[
                "\n\n# ", "\n\n## ", "\n\n### ", "\n\n", "\n",
                "।\n", "। ", ". ", "? ", "! ", " ", ""
            ],
            keep_separator=True
        )

    def split_documents(self, documents: List[Document]) -> List[Document]:
        """
        Splits a list of LangChain Document instances into smaller chunks.
        Guarantees that document_id, title, source_url, department, category,
        publication_date, and last_updated are preserved in every chunk.
        """
        all_chunks: List[Document] = []

        for doc_idx, doc in enumerate(documents):
            raw_chunks = self.splitter.split_documents([doc])
            doc_id = doc.metadata.get("document_id", f"doc_{doc_idx}")
            title = doc.metadata.get("title", "Government Scheme")

            for chunk_idx, chunk in enumerate(raw_chunks):
                # Ensure all vital metadata fields are explicitly retained
                chunk_meta = dict(chunk.metadata)
                chunk_meta.update({
                    "chunk_id": f"{doc_id}_chunk_{chunk_idx}",
                    "chunk_index": chunk_idx,
                    "total_chunks": len(raw_chunks),
                    "document_id": doc_id,
                    "title": title,
                    "source_url": doc.metadata.get("source_url", ""),
                    "department": doc.metadata.get("department", "Government of India"),
                    "category": doc.metadata.get("category", "General"),
                    "publication_date": doc.metadata.get("publication_date", ""),
                    "last_updated": doc.metadata.get("last_updated", ""),
                    "source_website": doc.metadata.get("source_website", "gov.in"),
                    "language": doc.metadata.get("language", "English"),
                    "language_code": doc.metadata.get("language_code", "en"),
                    "script": doc.metadata.get("script", "Latin"),
                    "is_multilingual": doc.metadata.get("is_multilingual", False),
                    "source_language": doc.metadata.get("source_language", doc.metadata.get("language", "English")),
                })
                chunk.metadata = chunk_meta
                all_chunks.append(chunk)

        return all_chunks

    def process_text_into_chunks(self, text: str, metadata: dict) -> List[Document]:
        """Convenience method to split plain text with given metadata into chunks."""
        doc = Document(page_content=text, metadata=metadata)
        return self.split_documents([doc])
