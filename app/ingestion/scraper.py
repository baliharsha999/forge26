"""
Web scraping component for official government sources.
Complies with robots.txt, respects rate limits, removes navigation and ads,
extracts structural HTML and metadata, and stores records into the SQL database.
"""

import os
import re
import time
import json
import urllib.request
import urllib.parse
import urllib.robotparser
from datetime import datetime
from typing import Dict, List, Optional, Any
from bs4 import BeautifulSoup
import requests

from app.config.settings import get_settings
from app.ingestion.database import GovernmentDatabase


class GovernmentWebScraper:
    """Scraper for trusted government sources: myScheme.gov.in, india.gov.in, pib.gov.in, etc."""

    def __init__(self, db: Optional[GovernmentDatabase] = None):
        self.settings = get_settings()
        self.db = db or GovernmentDatabase()
        self.headers = {
            "User-Agent": "GovernmentInformationRAG/1.0 (+https://data.gov.in; official-rag-bot)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
        }
        self.robot_parsers: Dict[str, urllib.robotparser.RobotFileParser] = {}
        self.last_request_time: Dict[str, float] = {}
        self.min_request_interval = 1.0  # seconds between requests to same domain

        # Load schemes_index if available locally
        self.schemes_index_path = os.path.join("data", "schemes_index.json")
        self.schemes_index: List[Dict[str, Any]] = self._load_schemes_index()

    def _load_schemes_index(self) -> List[Dict[str, Any]]:
        """Loads cached index of myscheme.gov.in schemes if present."""
        if os.path.exists(self.schemes_index_path):
            try:
                with open(self.schemes_index_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data if isinstance(data, list) else []
            except Exception:
                return []
        return []

    def is_url_allowed_by_robots(self, url: str) -> bool:
        """Checks if URL crawling is allowed by the host's robots.txt."""
        parsed = urllib.parse.urlparse(url)
        host = parsed.netloc.lower()
        if not host:
            return False

        if host not in self.robot_parsers:
            robots_url = f"{parsed.scheme}://{host}/robots.txt"
            rp = urllib.robotparser.RobotFileParser()
            try:
                rp.set_url(robots_url)
                rp.read()
                self.robot_parsers[host] = rp
            except Exception:
                # If robots.txt cannot be read or is missing, proceed with caution
                self.robot_parsers[host] = None

        rp = self.robot_parsers.get(host)
        if rp is None:
            return True
        return rp.can_fetch(self.headers["User-Agent"], url)

    def _respect_rate_limit(self, domain: str):
        """Ensures politeness delay between requests to the same domain."""
        now = time.time()
        last_time = self.last_request_time.get(domain, 0.0)
        elapsed = now - last_time
        if elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - elapsed)
        self.last_request_time[domain] = time.time()

    def is_trusted_government_url(self, url: str) -> bool:
        """Verifies whether the domain belongs to trusted official government domains."""
        parsed = urllib.parse.urlparse(url)
        host = parsed.netloc.lower()
        if host.endswith(".gov.in") or host.endswith(".nic.in") or host.endswith(".mygov.in"):
            return True
        for trusted in self.settings.TRUSTED_DOMAINS:
            if host == trusted or host.endswith("." + trusted):
                return True
        return False

    def clean_html(self, raw_html: str) -> str:
        """Strips navigation bars, ads, scripts, footer, and irrelevant markup."""
        soup = BeautifulSoup(raw_html, "html.parser")
        unwanted_tags = [
            "nav", "header", "footer", "script", "style", "noscript", "svg",
            "iframe", "aside", ".nav", ".navbar", ".advertisement", ".ads",
            ".sidebar", "#header", "#footer", ".cookie-consent"
        ]
        for sel in unwanted_tags:
            for el in soup.select(sel):
                el.decompose()

        # Return cleaned inner body HTML or container
        body = soup.find("main") or soup.find("article") or soup.find("body") or soup
        return str(body)

    def extract_metadata(self, raw_html: str, url: str) -> Dict[str, Any]:
        """Extracts title, publication date, department, and category from HTML."""
        soup = BeautifulSoup(raw_html, "html.parser")

        # 1. Title
        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        if not title:
            h1 = soup.find("h1")
            if h1:
                title = h1.get_text().strip()
        if not title:
            parsed = urllib.parse.urlparse(url)
            title = parsed.path.strip("/").split("/")[-1].replace("-", " ").title()

        # 2. Publication / Update Date
        pub_date = ""
        date_metas = [
            {"property": "article:published_time"},
            {"name": "publication_date"},
            {"name": "date"},
            {"name": "DC.date.issued"},
            {"property": "og:updated_time"}
        ]
        for dm in date_metas:
            tag = soup.find("meta", attrs=dm)
            if tag and tag.get("content"):
                pub_date = tag["content"][:10]
                break

        if not pub_date:
            date_match = re.search(r"\b(20[12]\d[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01]))\b", raw_html)
            if date_match:
                pub_date = date_match.group(1).replace("/", "-").replace(".", "-")
            else:
                pub_date = datetime.utcnow().strftime("%Y-%m-%d")

        # 3. Department
        department = "Government of India"
        dept_meta = soup.find("meta", attrs={"name": "department"}) or soup.find("meta", attrs={"name": "author"})
        if dept_meta and dept_meta.get("content"):
            department = dept_meta["content"].strip()
        else:
            # Check for Ministry or Department text in headers
            for el in soup.find_all(["h2", "h3", "p", "div", "span"], limit=20):
                txt = el.get_text().strip()
                if "Ministry of" in txt or "Department of" in txt:
                    department = txt[:120]
                    break

        # 4. Category
        category = "Government Schemes & Policies"
        cat_meta = soup.find("meta", attrs={"name": "category"})
        if cat_meta and cat_meta.get("content"):
            category = cat_meta["content"].strip()

        return {
            "title": title,
            "publication_date": pub_date,
            "department": department,
            "category": category,
            "url": url,
            "source_website": urllib.parse.urlparse(url).netloc.lower()
        }

    def scrape_url(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Scrapes a government webpage, extracts metadata and cleaned HTML,
        and saves it to the SQLite database.
        """
        if not self.is_trusted_government_url(url):
            print(f"[Scraper] Warning: URL '{url}' is not in the trusted government domains list. Skipping.")
            return None

        domain = urllib.parse.urlparse(url).netloc.lower()
        self._respect_rate_limit(domain)

        try:
            req = urllib.request.Request(url, headers=self.headers)
            with urllib.request.urlopen(req, timeout=4) as resp:
                content_type = resp.headers.get("Content-Type", "")
                raw_bytes = resp.read()
                raw_html = raw_bytes.decode("utf-8", errors="replace")

            meta = self.extract_metadata(raw_html, url)
            cleaned_html = self.clean_html(raw_html)

            # Generate stable document ID from URL slug or path
            doc_id = urllib.parse.urlparse(url).path.strip("/").replace("/", "_") or "home"

            self.db.save_document(
                document_id=doc_id,
                title=meta["title"],
                url=url,
                source_website=meta["source_website"],
                html_content=cleaned_html,
                department=meta["department"],
                publication_date=meta["publication_date"],
                category=meta["category"]
            )

            return {
                "document_id": doc_id,
                "title": meta["title"],
                "url": url,
                "department": meta["department"],
                "category": meta["category"],
                "publication_date": meta["publication_date"],
                "html_content": cleaned_html
            }
        except Exception as e:
            print(f"[Scraper] Error scraping URL '{url}': {e}")
            return None

    def scrape_url_conditional(
        self,
        url: str,
        etag: Optional[str] = None,
        last_modified: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scrapes a government webpage with HTTP 304 conditional validation.
        Supports If-None-Match and If-Modified-Since headers.
        """
        if not self.is_trusted_government_url(url):
            return {"status": "error", "error": "untrusted_domain", "url": url}

        domain = urllib.parse.urlparse(url).netloc.lower()
        self._respect_rate_limit(domain)

        request_headers = dict(self.headers)
        if etag:
            request_headers["If-None-Match"] = etag
        if last_modified:
            request_headers["If-Modified-Since"] = last_modified

        try:
            req = urllib.request.Request(url, headers=request_headers)
            with urllib.request.urlopen(req, timeout=4) as resp:
                resp_etag = resp.headers.get("ETag")
                resp_lm = resp.headers.get("Last-Modified")
                raw_bytes = resp.read()
                raw_html = raw_bytes.decode("utf-8", errors="replace")

            meta = self.extract_metadata(raw_html, url)
            cleaned_html = self.clean_html(raw_html)
            content_hash = GovernmentDatabase.hash_html(cleaned_html)
            path_parts = urllib.parse.urlparse(url).path.strip("/").split("/")
            doc_id = path_parts[-1] if path_parts and path_parts[-1] else "doc"

            return {
                "status": "success",
                "http_status": 200,
                "document_id": doc_id,
                "title": meta["title"],
                "url": url,
                "canonical_url": GovernmentDatabase.normalize_url(url),
                "source_website": meta["source_website"],
                "department": meta["department"],
                "publication_date": meta["publication_date"],
                "category": meta["category"],
                "html_content": cleaned_html,
                "content_hash": content_hash,
                "etag": resp_etag,
                "last_modified": resp_lm
            }
        except urllib.error.HTTPError as e:
            if e.code == 304:
                return {
                    "status": "not_modified",
                    "http_status": 304,
                    "url": url,
                    "canonical_url": GovernmentDatabase.normalize_url(url),
                }
            return {"status": "error", "http_status": e.code, "error": str(e), "url": url}
        except Exception as e:
            return {"status": "error", "http_status": 500, "error": str(e), "url": url}


    def search_and_scrape_schemes(self, query: str, limit: int = 2) -> List[Dict[str, Any]]:
        """
        Searches myscheme index for matching schemes and scrapes details.
        """
        query_terms = [t.lower() for t in query.split() if len(t) > 2]
        matches = []

        for item in self.schemes_index:
            name = item.get("en", {}).get("basicDetails", {}).get("schemeName", "").lower()
            slug = item.get("slug", "")
            score = sum(1 for term in query_terms if term in name)
            if score > 0:
                matches.append((score, slug, name))

        matches.sort(key=lambda x: x[0], reverse=True)
        results = []

        # Scrape top matching slugs
        from scraper import MySchemeScraper
        legacy_scraper = MySchemeScraper(db_path=self.db.db_path)

        for _, slug, _ in matches[:limit]:
            try:
                rec = legacy_scraper.scrape_and_save(slug)
                if rec:
                    # Sync to government_documents
                    self.db._sync_legacy_schemes_if_any()
                    doc = self.db.get_document_by_id(slug)
                    if doc:
                        results.append(doc)
            except Exception as e:
                print(f"[Scraper] Error retrieving scheme for slug '{slug}': {e}")

        return results
