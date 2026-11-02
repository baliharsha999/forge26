"""
Web Scraping Agent for searching, validating, and ingesting official government documents.
Coordinates source discovery, domain whitelist validation, canonical URL normalization,
robots.txt compliance, HTTP 304 conditional validation, metadata extraction,
and concurrency safety.
"""

from typing import List, Dict, Any, Optional
import urllib.parse
from app.ingestion.scraper import GovernmentWebScraper
from app.ingestion.database import GovernmentDatabase
from app.config.settings import get_settings


class ScrapingAgent:
    """Agent responsible for identifying, validating, and acquiring official government documents."""

    def __init__(self, db: Optional[GovernmentDatabase] = None):
        self.db = db or GovernmentDatabase()
        self.scraper = GovernmentWebScraper(db=self.db)
        self.settings = get_settings()

    def search_sources(
        self,
        query: str,
        keywords: Optional[List[str]] = None,
        department: Optional[str] = None,
        max_results: int = 3
    ) -> List[str]:
        """
        Discovers official government URLs for a query/topic by searching
        official schemes index or constructing verified official URLs.
        """
        discovered: List[str] = []

        # 1. High precision catalog ranking via MySchemeScraper
        try:
            from scraper import get_shared_scraper
            ms_scraper = get_shared_scraper(db_path=self.db.db_path)
            ranked = ms_scraper.search_schemes(
                query, top_k=max_results, min_score=30, min_overlap=2
            )
            for item in ranked:
                slug = item.get("slug")
                if slug:
                    url = f"https://www.myscheme.gov.in/schemes/{slug}"
                    if url not in discovered:
                        discovered.append(url)
        except Exception as e:
            print(f"[ScrapingAgent] MySchemeScraper search failed: {e}")

        # 2. If nothing discovered, try distinctive keyword search across schemes_index
        if not discovered:
            STOPWORDS = {
                "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
                "about", "government", "india", "scheme", "schemes", "yojana", "under",
                "benefits", "benefit", "eligibility", "eligible", "apply", "application",
                "process", "details", "features", "documents", "required", "status",
                "criteria", "guidelines", "portal", "website", "online", "national",
                "central", "state", "ministry", "department", "tell", "give", "know",
                "information", "info", "present", "available", "there", "have", "with",
                "from", "that", "this", "these", "those", "does", "provide", "assistance"
            }
            terms = [t.lower().strip("?,.:;\"'()[]{}") for t in (keywords or query.split())]
            search_terms = [t for t in terms if len(t) > 2 and t not in STOPWORDS]

            scored_items = []
            for item in self.scraper.schemes_index:
                name = item.get("en", {}).get("basicDetails", {}).get("schemeName", "").lower()
                slug = item.get("slug", "").lower()
                score = sum(1 for term in search_terms if term in name or term in slug)
                if score > 0:
                    scored_items.append((score, slug))

            scored_items.sort(key=lambda x: x[0], reverse=True)
            for _, slug in scored_items[:max_results]:
                url = f"https://www.myscheme.gov.in/schemes/{slug}"
                if url not in discovered:
                    discovered.append(url)

        return discovered[:max_results]

    def validate_urls(self, urls: List[str]) -> List[str]:
        """
        Filters and validates candidate URLs:
        - Must match official government domains (.gov.in, .nic.in, .mygov.in, or trusted whitelist)
        - Normalizes to canonical URL format (strips tracking, anchors, trailing slashes)
        - Deduplicates list
        """
        validated: List[str] = []
        seen = set()

        for u in urls:
            if not u or not isinstance(u, str):
                continue
            canonical = GovernmentDatabase.normalize_url(u)
            if canonical in seen:
                continue

            if self.scraper.is_trusted_government_url(canonical):
                validated.append(canonical)
                seen.add(canonical)
            else:
                print(f"[ScrapingAgent] Rejected untrusted domain URL: {u}")

        return validated

    def scrape_url(
        self,
        url: str,
        etag: Optional[str] = None,
        last_modified: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scrapes a single validated URL with concurrency safety and conditional HTTP headers.
        """
        canonical_url = GovernmentDatabase.normalize_url(url)

        # Acquire lock
        if not self.db.acquire_ingestion_lock(canonical_url):
            return {
                "status": "in_progress",
                "message": f"URL {canonical_url} is currently being ingested by another request.",
                "url": url,
                "canonical_url": canonical_url
            }

        try:
            res = self.scraper.scrape_url_conditional(
                url=canonical_url,
                etag=etag,
                last_modified=last_modified
            )
            return res
        finally:
            self.db.release_ingestion_lock(canonical_url)

    def discover_and_scrape(self, topic_or_query: str, max_documents: int = 3) -> List[Dict[str, Any]]:
        """
        Discovers relevant government documents for the specified topic/query,
        fetches full HTML, extracts metadata, and stores into SQL database.
        """
        print(f"[ScrapingAgent] Searching trusted government portals for '{topic_or_query}'...")
        scraped_docs = self.scraper.search_and_scrape_schemes(topic_or_query, limit=max_documents)
        print(f"[ScrapingAgent] Successfully retrieved and stored {len(scraped_docs)} documents.")
        return scraped_docs

    def scrape_direct_url(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Scrapes a direct official URL and stores it into the database.
        """
        print(f"[ScrapingAgent] Ingesting URL: {url}")
        return self.scraper.scrape_url(url)
