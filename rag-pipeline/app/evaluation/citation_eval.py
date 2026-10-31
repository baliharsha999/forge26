"""
Citation Validation Module.
Validates all cited URLs and departments against retrieved document metadata and SQLite database records.
Rejects fabricated citations and formats verified source metadata including last_verified_date.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.ingestion.database import GovernmentDatabase


class VerifiedCitation(BaseModel):
    """Verified official citation with complete provenance metadata."""

    title: str = Field(description="Official document title")
    department: str = Field(description="Issuing ministry or department")
    url: str = Field(description="Verified official URL")
    publication_date: str = Field(description="Publication or update date")
    last_verified_date: str = Field(description="Timestamp when source was validated")
    is_valid: bool = Field(description="Whether the citation matched a genuine document")
    validation_notes: str = Field(description="Verification notes")


class CitationValidationResult(BaseModel):
    """Overall outcome of citation validation."""

    total_citations: int
    valid_citations: int
    invalid_citations: int
    verified_sources: List[VerifiedCitation]
    all_valid: bool


class CitationValidator:
    """Validates citations against context metadata and database records."""

    def __init__(self, db: Optional[GovernmentDatabase] = None):
        self.db = db or GovernmentDatabase()
        self.verification_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def validate_citations(
        self,
        citations: List[Dict[str, Any]],
        context_documents: List[Dict[str, Any]]
    ) -> CitationValidationResult:
        """
        Cross-checks citations against retrieved document metadata and SQLite records.
        Filters out unsupported or fabricated links.
        """
        valid_sources: List[VerifiedCitation] = []
        invalid_count = 0

        # Build lookup from retrieved document metadata
        retrieved_urls = {}
        for doc in context_documents:
            meta = doc.get("metadata", {})
            u = meta.get("source_url") or meta.get("url")
            if u:
                retrieved_urls[u.lower().strip()] = meta

        # Also get all database URLs for fallback verification
        all_db_docs = self.db.fetch_all_documents()
        db_urls = {d["url"].lower().strip(): d for d in all_db_docs}

        for c in citations:
            raw_url = (c.get("url") or "").strip()
            clean_url = raw_url.lower()
            title = c.get("title") or "Official Government Scheme"
            dept = c.get("department") or "Government of India"
            pub_date = c.get("publication_date") or self.verification_timestamp

            # 1. Check if URL was present in retrieved chunks
            matched_meta = retrieved_urls.get(clean_url)
            # 2. Check if URL exists in official database
            matched_db = db_urls.get(clean_url)

            if matched_meta or matched_db:
                # Genuine citation verified against ground truth records
                source_meta = matched_meta or matched_db
                verified_title = source_meta.get("title") or title
                verified_dept = source_meta.get("department") or dept
                verified_date = str(source_meta.get("publication_date") or pub_date)[:10]

                valid_sources.append(VerifiedCitation(
                    title=verified_title,
                    department=verified_dept,
                    url=raw_url,
                    publication_date=verified_date,
                    last_verified_date=self.verification_timestamp,
                    is_valid=True,
                    validation_notes="Verified against retrieved official document metadata."
                ))
            else:
                # Fabricated or ungrounded URL
                invalid_count += 1

        # If citations were empty but documents were retrieved, automatically generate from retrieved context
        if not valid_sources and context_documents:
            seen = set()
            for doc in context_documents[:3]:
                meta = doc.get("metadata", {})
                u = meta.get("source_url") or meta.get("url")
                if u and u not in seen:
                    seen.add(u)
                    valid_sources.append(VerifiedCitation(
                        title=meta.get("title", "Official Government Scheme"),
                        department=meta.get("department", "Government of India"),
                        url=u,
                        publication_date=str(meta.get("publication_date") or self.verification_timestamp)[:10],
                        last_verified_date=self.verification_timestamp,
                        is_valid=True,
                        validation_notes="Extracted directly from top retrieved official context."
                    ))

        return CitationValidationResult(
            total_citations=len(citations),
            valid_citations=len(valid_sources),
            invalid_citations=invalid_count,
            verified_sources=valid_sources,
            all_valid=(invalid_count == 0 and len(valid_sources) > 0)
        )
