"""
Database layer for Government Information RAG System.
Manages persistent storage of raw HTML, document metadata, source URLs, content hashes,
canonical URLs, indexing statuses, ETags, and freshness timestamps.
Includes concurrency locking, duplicate detection, and keyword/department searching.
"""

import os
import re
import sqlite3
import hashlib
import threading
import urllib.parse
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Set, Tuple
from app.config.settings import get_settings


class GovernmentDatabase:
    """SQLite Database manager for official government documents, metadata, and indexing states."""

    _class_lock = threading.Lock()
    _in_progress_urls: Set[str] = set()

    def __init__(self, db_path: Optional[str] = None):
        settings = get_settings()
        self.db_path = db_path or settings.DB_PATH
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self.init_db()
        self._sync_legacy_schemes_if_any()
        self._sync_faiss_indexing_state()

    def get_connection(self) -> sqlite3.Connection:
        """Obtain a SQLite connection with dict-like row access."""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def normalize_url(url: str) -> str:
        """
        Normalizes a URL to a canonical format:
        - Lowercases scheme and hostname
        - Removes default ports (80 for http, 443 for https)
        - Removes trailing slashes (except root '/')
        - Strips URL fragments (#...)
        - Strips tracking / analytics query parameters (utm_*, ref, fbclid, gclid, etc.)
        """
        if not url:
            return ""
        parsed = urllib.parse.urlsplit(url.strip())
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()

        # Remove default port
        if scheme == "http" and netloc.endswith(":80"):
            netloc = netloc[:-3]
        elif scheme == "https" and netloc.endswith(":443"):
            netloc = netloc[:-4]

        # Strip trailing slash from path unless it's root
        path = parsed.path
        if len(path) > 1 and path.endswith("/"):
            path = path.rstrip("/")

        # Filter query parameters
        query_params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        tracking_prefixes = ("utm_",)
        tracking_keys = {"ref", "fbclid", "gclid", "_ga", "source", "sessionid", "sid"}
        filtered_params = [
            (k, v) for k, v in query_params
            if not (any(k.lower().startswith(p) for p in tracking_prefixes) or k.lower() in tracking_keys)
        ]
        # Sort query params for deterministic canonical URL
        filtered_params.sort(key=lambda x: x[0])
        query = urllib.parse.urlencode(filtered_params)

        return urllib.parse.urlunsplit((scheme, netloc, path, query, ""))

    @staticmethod
    def hash_html(html_str: str) -> str:
        """Computes SHA-256 hash of normalized HTML content."""
        normalized = (html_str or "").strip()
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def init_db(self):
        """Initialize database schema with government_documents table, columns, and indexes."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS government_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                canonical_url TEXT,
                source_website TEXT NOT NULL,
                department TEXT,
                publication_date TEXT,
                last_updated TEXT,
                html_content TEXT NOT NULL,
                category TEXT,
                scraped_at TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                is_indexed BOOLEAN DEFAULT 0,
                index_status TEXT DEFAULT 'pending',
                embedding_model TEXT,
                chunk_count INTEGER DEFAULT 0,
                last_scraped_at TEXT,
                last_indexed_at TEXT,
                last_verified_at TEXT,
                etag TEXT,
                http_last_modified TEXT,
                language TEXT DEFAULT 'English',
                language_code TEXT DEFAULT 'en',
                script TEXT DEFAULT 'Latin',
                is_multilingual BOOLEAN DEFAULT 0,
                source_language TEXT DEFAULT 'English'
            );
            """)

            # Dynamic migration: add any missing columns to existing tables
            existing_cols = {row[1] for row in cursor.execute("PRAGMA table_info(government_documents)").fetchall()}
            column_definitions = {
                "canonical_url": "TEXT",
                "is_indexed": "BOOLEAN DEFAULT 0",
                "index_status": "TEXT DEFAULT 'pending'",
                "embedding_model": "TEXT",
                "chunk_count": "INTEGER DEFAULT 0",
                "last_scraped_at": "TEXT",
                "last_indexed_at": "TEXT",
                "last_verified_at": "TEXT",
                "etag": "TEXT",
                "http_last_modified": "TEXT",
                "language": "TEXT DEFAULT 'English'",
                "language_code": "TEXT DEFAULT 'en'",
                "script": "TEXT DEFAULT 'Latin'",
                "is_multilingual": "BOOLEAN DEFAULT 0",
                "source_language": "TEXT DEFAULT 'English'",
                "document_version": "INTEGER DEFAULT 1",
                "last_checked": "TEXT",
                "last_indexed": "TEXT",
                "status": "TEXT DEFAULT 'active'",
                "vector_store_status": "TEXT DEFAULT 'indexed'",
                "needs_reindexing": "BOOLEAN DEFAULT 0",
                "change_summary": "TEXT"
            }
            for col_name, col_def in column_definitions.items():
                if col_name not in existing_cols:
                    cursor.execute(f"ALTER TABLE government_documents ADD COLUMN {col_name} {col_def}")

            # Indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_gov_doc_id ON government_documents(document_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_gov_url ON government_documents(url);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_gov_canonical_url ON government_documents(canonical_url);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_gov_dept ON government_documents(department);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_gov_category ON government_documents(category);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_gov_is_indexed ON government_documents(is_indexed);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_gov_content_hash ON government_documents(content_hash);")
            conn.commit()

    def _sync_legacy_schemes_if_any(self):
        """Migrate any pre-existing records from legacy schemes table if present."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            if "schemes" in tables:
                rows = cursor.execute("""
                    SELECT slug, scheme_name, ministry, department, category, total_html, scraped_at, updated_at
                    FROM schemes
                """).fetchall()

                for r in rows:
                    slug = r["slug"]
                    title = r["scheme_name"] or slug
                    dept = r["department"] or r["ministry"] or "Government of India"
                    cat = r["category"] or "General"
                    html = r["total_html"] or ""
                    scraped_at = r["scraped_at"] or datetime.utcnow().isoformat()
                    updated_at = r["updated_at"] or scraped_at
                    url = f"https://www.myscheme.gov.in/schemes/{slug}"
                    canonical_url = self.normalize_url(url)
                    source = "myscheme.gov.in"
                    content_hash = self.hash_html(html)

                    cursor.execute("""
                        INSERT OR IGNORE INTO government_documents (
                            document_id, title, url, canonical_url, source_website, department,
                            publication_date, last_updated, html_content, category,
                            scraped_at, content_hash, last_scraped_at, last_verified_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        slug, title, url, canonical_url, source, dept,
                        updated_at[:10] if updated_at else "2024-01-01",
                        updated_at, html, cat, scraped_at, content_hash,
                        scraped_at, updated_at
                    ))
                conn.commit()

    def _sync_faiss_indexing_state(self):
        """Populates is_indexed and canonical_url flags for existing records if missing."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT document_id, url, canonical_url, scraped_at, last_updated, is_indexed FROM government_documents").fetchall()
            for r in rows:
                doc_id = r["document_id"]
                url = r["url"]
                can_url = r["canonical_url"] or self.normalize_url(url)
                scraped_at = r["scraped_at"] or datetime.utcnow().isoformat()
                last_updated = r["last_updated"] or scraped_at

                cursor.execute("""
                    UPDATE government_documents
                    SET canonical_url = COALESCE(canonical_url, ?),
                        last_scraped_at = COALESCE(last_scraped_at, ?),
                        last_verified_at = COALESCE(last_verified_at, ?)
                    WHERE document_id = ?
                """, (can_url, scraped_at, last_updated, doc_id))
            conn.commit()

    def acquire_ingestion_lock(self, canonical_url: str) -> bool:
        """
        Thread-safe concurrency lock for in-flight document scraping / ingestion.
        Returns True if lock acquired, False if already in-progress by another thread.
        """
        with self._class_lock:
            if canonical_url in self._in_progress_urls:
                return False
            self._in_progress_urls.add(canonical_url)
            return True

    def release_ingestion_lock(self, canonical_url: str):
        """Releases concurrency lock for a canonical URL."""
        with self._class_lock:
            self._in_progress_urls.discard(canonical_url)

    def increment_version(self, document_id: str) -> int:
        """Increment the version number for a document and return the new version."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT document_version FROM government_documents WHERE document_id = ?", (document_id,))
            row = cur.fetchone()
            current = row["document_version"] if row else 1
            new_version = current + 1
            cur.execute("UPDATE government_documents SET document_version = ?, needs_reindexing = 1 WHERE document_id = ?", (new_version, document_id))
            conn.commit()
            return new_version

    def update_last_checked(self, canonical_url: str) -> None:
        """Update the last_checked timestamp for a document identified by its canonical URL."""
        now = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            conn.execute("UPDATE government_documents SET last_checked = ?, last_verified_at = ? WHERE canonical_url = ? OR url = ?", (now, now, canonical_url, canonical_url))
            conn.commit()

    def store_change_summary(self, document_id: str, version: int, summary: str) -> None:
        """Store a textual summary of what changed for a given document version."""
        with self.get_connection() as conn:
            conn.execute(
                "UPDATE government_documents SET change_summary = ?, document_version = ?, last_indexed_at = ?, last_checked = ? WHERE document_id = ?",
                (summary, version, datetime.utcnow().isoformat(), datetime.utcnow().isoformat(), document_id),
            )
            conn.commit()

    def get_historical_versions(self, document_id: str) -> List[Dict[str, Any]]:
        """Return all versions of a document with their metadata (excluding large HTML)."""
        with self.get_connection() as conn:
            rows = conn.execute(
                "SELECT document_version, status, last_indexed_at, change_summary FROM government_documents WHERE document_id = ? ORDER BY document_version DESC",
                (document_id,),
            ).fetchall()
            return [dict(r) for r in rows]

        """
        Checks whether document exists by canonical URL and whether its content has changed.
        Returns:
            exists: bool
            is_indexed: bool
            content_changed: bool
            document: Optional[Dict[str, Any]]
        """
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM government_documents WHERE canonical_url = ? OR url = ?",
                (canonical_url, canonical_url)
            ).fetchone()

            if not row:
                return {
                    "exists": False,
                    "is_indexed": False,
                    "content_changed": False,
                    "document": None
                }

            doc_dict = dict(row)
            stored_hash = doc_dict.get("content_hash", "")
            content_changed = bool(content_hash and content_hash != stored_hash)

            return {
                "exists": True,
                "is_indexed": bool(doc_dict.get("is_indexed")),
                "content_changed": content_changed,
                "document": doc_dict
            }

    def check_freshness(self, document_id: str, max_age_days: int = 30) -> Dict[str, Any]:
        """
        Evaluates document freshness based on last_verified_at or last_scraped_at.
        Returns freshness status and metadata for conditional HTTP requests.
        """
        doc = self.get_document_by_id(document_id)
        if not doc:
            return {"is_fresh": False, "reason": "not_found", "etag": None, "last_modified": None}

        last_check = doc.get("last_verified_at") or doc.get("last_scraped_at") or doc.get("last_updated")
        etag = doc.get("etag")
        http_lm = doc.get("http_last_modified")

        if not last_check:
            return {"is_fresh": False, "reason": "no_timestamp", "etag": etag, "last_modified": http_lm}

        try:
            # Parse ISO or YYYY-MM-DD
            ts_str = last_check[:19].replace(" ", "T")
            dt = datetime.fromisoformat(ts_str)
            age = (datetime.utcnow() - dt).days
            is_fresh = age < max_age_days
            return {
                "is_fresh": is_fresh,
                "age_days": age,
                "etag": etag,
                "last_modified": http_lm,
                "last_verified_at": last_check
            }
        except Exception:
            return {"is_fresh": True, "age_days": 0, "etag": etag, "last_modified": http_lm}

    def search_documents(
        self,
        keywords: List[str],
        department: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Searches existing database for matching documents based on keywords, topics, and department.
        Matches against document_id, title, department, category, and html_content.
        """
        with self.get_connection() as conn:
            all_rows = conn.execute("SELECT * FROM government_documents").fetchall()

            scored_docs: List[Tuple[float, Dict[str, Any]]] = []
            COMMON_STOPWORDS = {
                "the", "a", "an", "and", "or", "but", "if", "for", "with", "about",
                "from", "into", "over", "under", "after", "before", "between",
                "scheme", "schemes", "yojana", "yojna", "government", "india", "details",
                "benefit", "benefits", "eligibility", "eligible", "apply", "application",
                "what", "when", "where", "which", "how", "who", "whom", "whose"
            }
            clean_keywords = [
                k.lower().strip() for k in keywords
                if len(k.strip()) > 2 and k.lower().strip() not in COMMON_STOPWORDS
            ] or [k.lower().strip() for k in keywords if len(k.strip()) > 2]

            for row in all_rows:
                doc = dict(row)
                score = 0.0
                title_lower = (doc.get("title") or "").lower()
                doc_id_lower = (doc.get("document_id") or "").lower()
                dept_lower = (doc.get("department") or "").lower()
                cat_lower = (doc.get("category") or "").lower()
                html_lower = (doc.get("html_content") or "")[:4000].lower()

                # Department filter / boost
                if department and department.lower() in dept_lower:
                    score += 5.0

                for kw in clean_keywords:
                    # Title / document_id exact match is high value
                    if kw in title_lower or kw in doc_id_lower:
                        score += 3.0
                    if kw in dept_lower or kw in cat_lower:
                        score += 2.0
                    if kw in html_lower:
                        score += 1.0

                if score > 0:
                    scored_docs.append((score, doc))

            # Sort descending by match score
            scored_docs.sort(key=lambda x: x[0], reverse=True)
            return [d for _, d in scored_docs[:limit]]

    def save_document(
        self,
        document_id: str,
        title: str,
        url: str,
        source_website: str,
        html_content: str,
        department: Optional[str] = None,
        publication_date: Optional[str] = None,
        last_updated: Optional[str] = None,
        category: Optional[str] = None,
        scraped_at: Optional[str] = None,
        etag: Optional[str] = None,
        http_last_modified: Optional[str] = None,
        is_indexed: bool = False,
        language: str = "English",
        language_code: str = "en",
        script: str = "Latin",
        is_multilingual: bool = False,
        source_language: str = "English",
    ) -> bool:
        """Insert or update a government document record in the database."""
        scraped_at = scraped_at or datetime.utcnow().isoformat()
        last_updated = last_updated or scraped_at
        publication_date = publication_date or last_updated[:10]
        canonical_url = self.normalize_url(url)
        content_hash = self.hash_html(html_content)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO government_documents (
                    document_id, title, url, canonical_url, source_website, department,
                    publication_date, last_updated, html_content, category,
                    scraped_at, content_hash, is_indexed, index_status,
                    last_scraped_at, last_verified_at, etag, http_last_modified,
                    language, language_code, script, is_multilingual, source_language
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(document_id) DO UPDATE SET
                    title=excluded.title,
                    url=excluded.url,
                    canonical_url=excluded.canonical_url,
                    source_website=excluded.source_website,
                    department=excluded.department,
                    publication_date=excluded.publication_date,
                    last_updated=excluded.last_updated,
                    html_content=excluded.html_content,
                    category=excluded.category,
                    scraped_at=excluded.scraped_at,
                    content_hash=excluded.content_hash,
                    is_indexed=excluded.is_indexed,
                    index_status=excluded.index_status,
                    last_scraped_at=excluded.last_scraped_at,
                    last_verified_at=excluded.last_verified_at,
                    etag=COALESCE(excluded.etag, government_documents.etag),
                    http_last_modified=COALESCE(excluded.http_last_modified, government_documents.http_last_modified),
                    language=excluded.language,
                    language_code=excluded.language_code,
                    script=excluded.script,
                    is_multilingual=excluded.is_multilingual,
                    source_language=excluded.source_language
            """, (
                document_id, title, url, canonical_url, source_website, department or "Government of India",
                publication_date, last_updated, html_content, category or "General",
                scraped_at, content_hash, int(is_indexed), "indexed" if is_indexed else "pending",
                scraped_at, last_updated, etag, http_last_modified,
                language, language_code, script, int(is_multilingual), source_language
            ))
            conn.commit()
            return True

    def mark_document_indexed(
        self,
        document_id: str,
        chunk_count: int,
        embedding_model: Optional[str] = None
    ) -> bool:
        """Marks a document as embedded and present in the FAISS index."""
        now = datetime.utcnow().isoformat()
        settings = get_settings()
        model_name = embedding_model or settings.EMBEDDING_MODEL_NAME
        with self.get_connection() as conn:
            conn.execute("""
                UPDATE government_documents
                SET is_indexed = 1,
                    index_status = 'indexed',
                    chunk_count = ?,
                    embedding_model = ?,
                    last_indexed_at = ?
                WHERE document_id = ?
            """, (chunk_count, model_name, now, document_id))
            conn.commit()
            return True

    def mark_document_unindexed(self, document_id: str) -> bool:
        """Marks a document as requiring re-indexing (e.g. after content update)."""
        with self.get_connection() as conn:
            conn.execute("""
                UPDATE government_documents
                SET is_indexed = 0,
                    index_status = 'pending',
                    chunk_count = 0
                WHERE document_id = ?
            """, (document_id,))
            conn.commit()
            return True

    def update_document_verification(
        self,
        document_id: str,
        etag: Optional[str] = None,
        last_modified: Optional[str] = None
    ) -> bool:
        """Refreshes last_verified_at timestamp and caches HTTP conditional headers."""
        now = datetime.utcnow().isoformat()
        with self.get_connection() as conn:
            conn.execute("""
                UPDATE government_documents
                SET last_verified_at = ?,
                    etag = COALESCE(?, etag),
                    http_last_modified = COALESCE(?, http_last_modified)
                WHERE document_id = ?
            """, (now, etag, last_modified, document_id))
            conn.commit()
            return True

    def get_document_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single document by its document_id."""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM government_documents WHERE document_id = ?",
                (document_id,)
            ).fetchone()
            return dict(row) if row else None

    def get_document_by_url(self, url: str) -> Optional[Dict[str, Any]]:
        """Fetch a single document by its source URL or canonical URL."""
        can_url = self.normalize_url(url)
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM government_documents WHERE canonical_url = ? OR url = ?",
                (can_url, url)
            ).fetchone()
            return dict(row) if row else None

    def fetch_all_documents(self) -> List[Dict[str, Any]]:
        """Retrieve all stored government documents with metadata and HTML."""
        with self.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM government_documents ORDER BY id ASC"
            ).fetchall()
            return [dict(r) for r in rows]

    def fetch_html_documents(self, document_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Fetch HTML content and metadata for specified document IDs, or all if None."""
        with self.get_connection() as conn:
            if document_ids:
                placeholders = ",".join("?" for _ in document_ids)
                rows = conn.execute(
                    f"SELECT * FROM government_documents WHERE document_id IN ({placeholders})",
                    tuple(document_ids)
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM government_documents").fetchall()
            return [dict(r) for r in rows]

    def count_documents(self) -> int:
        """Return total number of indexed government documents."""
        with self.get_connection() as conn:
            return conn.execute("SELECT COUNT(*) FROM government_documents").fetchone()[0]
