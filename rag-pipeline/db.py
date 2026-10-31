"""
SQL Database Manager for myScheme Intelligence Agent
Stores scraped scheme records, full compiled HTML files, raw web HTML,
and conversation interactions directly in an SQL database.
"""

import os
import sys
import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Any

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DEFAULT_DB_PATH = r"d:\forge26\schemes.db"


def clean_str(val: Any) -> str:
    """Safely converts scalar or dict/list values into clean strings for SQL binding."""
    if val is None:
        return ""
    if isinstance(val, dict):
        return val.get("label") or val.get("value") or val.get("name") or json.dumps(val)
    if isinstance(val, list):
        return ", ".join(clean_str(x) for x in val)
    return str(val)


class SchemeDatabase:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        """Returns SQLite connection with row factory enabled."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        """Creates the required tables and indexes if they do not exist."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Table for full scheme details and total HTML files
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS schemes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                scheme_name TEXT NOT NULL,
                short_title TEXT,
                ministry TEXT,
                department TEXT,
                level TEXT,
                category TEXT,
                tags TEXT,
                target_beneficiaries TEXT,
                dbt_scheme TEXT,
                brief_description TEXT,
                detailed_description TEXT,
                eligibility_criteria TEXT,
                benefits TEXT,
                exclusions TEXT,
                application_process TEXT,
                documents_required TEXT,
                faqs_json TEXT,
                references_json TEXT,
                total_html TEXT NOT NULL,
                raw_html TEXT,
                json_data TEXT,
                html_size_bytes INTEGER,
                scraped_at TEXT,
                updated_at TEXT
            )
            """)

            # Table for user chat sessions and evaluations
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                user_query TEXT NOT NULL,
                matched_slug TEXT,
                scheme_name TEXT,
                eligibility_verdict TEXT,
                agent_response TEXT,
                created_at TEXT,
                FOREIGN KEY (matched_slug) REFERENCES schemes (slug)
            )
            """)

            # Indexes for high performance searches
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_schemes_slug ON schemes(slug)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_schemes_name ON schemes(scheme_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id)")
            conn.commit()

    def save_scheme(self, scheme_data: Dict[str, Any]) -> int:
        """
        Inserts or updates a scheme record directly into the SQL database.
        Stores the total HTML document, raw webpage HTML, structured text, and metadata.
        """
        slug = scheme_data["slug"].strip().lower()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        total_html = scheme_data.get("total_html", "")
        raw_html = scheme_data.get("raw_html", "")
        html_size = len(total_html.encode("utf-8")) if total_html else 0

        # Serialize complex objects to JSON strings if needed
        faqs_json = json.dumps(scheme_data.get("faqs", []), ensure_ascii=False)
        references_json = json.dumps(scheme_data.get("references", []), ensure_ascii=False)
        json_data = json.dumps(scheme_data.get("details", {}), ensure_ascii=False)

        tags_val = scheme_data.get("tags", "")
        if isinstance(tags_val, list):
            tags_val = ", ".join(tags_val)

        beneficiaries_val = scheme_data.get("target_beneficiaries", "")
        if isinstance(beneficiaries_val, list):
            beneficiaries_val = ", ".join(beneficiaries_val)

        query = """
        INSERT INTO schemes (
            slug, scheme_name, short_title, ministry, department, level, category,
            tags, target_beneficiaries, dbt_scheme, brief_description, detailed_description,
            eligibility_criteria, benefits, exclusions, application_process, documents_required,
            faqs_json, references_json, total_html, raw_html, json_data, html_size_bytes,
            scraped_at, updated_at
        ) VALUES (
            :slug, :scheme_name, :short_title, :ministry, :department, :level, :category,
            :tags, :target_beneficiaries, :dbt_scheme, :brief_description, :detailed_description,
            :eligibility_criteria, :benefits, :exclusions, :application_process, :documents_required,
            :faqs_json, :references_json, :total_html, :raw_html, :json_data, :html_size_bytes,
            :scraped_at, :updated_at
        )
        ON CONFLICT(slug) DO UPDATE SET
            scheme_name = excluded.scheme_name,
            short_title = excluded.short_title,
            ministry = excluded.ministry,
            department = excluded.department,
            level = excluded.level,
            category = excluded.category,
            tags = excluded.tags,
            target_beneficiaries = excluded.target_beneficiaries,
            dbt_scheme = excluded.dbt_scheme,
            brief_description = excluded.brief_description,
            detailed_description = excluded.detailed_description,
            eligibility_criteria = excluded.eligibility_criteria,
            benefits = excluded.benefits,
            exclusions = excluded.exclusions,
            application_process = excluded.application_process,
            documents_required = excluded.documents_required,
            faqs_json = excluded.faqs_json,
            references_json = excluded.references_json,
            total_html = excluded.total_html,
            raw_html = excluded.raw_html,
            json_data = excluded.json_data,
            html_size_bytes = excluded.html_size_bytes,
            updated_at = excluded.updated_at
        """

        params = {
            "slug": slug,
            "scheme_name": clean_str(scheme_data.get("scheme_name", slug)),
            "short_title": clean_str(scheme_data.get("short_title", slug)),
            "ministry": clean_str(scheme_data.get("ministry", "")),
            "department": clean_str(scheme_data.get("department", "")),
            "level": clean_str(scheme_data.get("level", "Central")),
            "category": clean_str(scheme_data.get("category", "")),
            "tags": clean_str(tags_val),
            "target_beneficiaries": clean_str(beneficiaries_val),
            "dbt_scheme": clean_str(scheme_data.get("dbt_scheme", "No")),
            "brief_description": clean_str(scheme_data.get("brief_description", "")),
            "detailed_description": clean_str(scheme_data.get("detailed_description", "")),
            "eligibility_criteria": clean_str(scheme_data.get("eligibility_criteria", "")),
            "benefits": clean_str(scheme_data.get("benefits", "")),
            "exclusions": clean_str(scheme_data.get("exclusions", "")),
            "application_process": clean_str(scheme_data.get("application_process", "")),
            "documents_required": clean_str(scheme_data.get("documents_required", "")),
            "faqs_json": faqs_json,
            "references_json": references_json,
            "total_html": total_html,
            "raw_html": raw_html,
            "json_data": json_data,
            "html_size_bytes": html_size,
            "scraped_at": now_str,
            "updated_at": now_str
        }

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()
            return cursor.lastrowid

    def get_scheme(self, slug: str) -> Optional[Dict[str, Any]]:
        """Retrieves a complete scheme record from the SQL database by slug."""
        slug = slug.strip().lower()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM schemes WHERE slug = ?", (slug,))
            row = cursor.fetchone()
            if row:
                return dict(row)
        return None

    def get_scheme_html(self, slug: str) -> Optional[str]:
        """Retrieves only the total HTML content from the SQL database."""
        slug = slug.strip().lower()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT total_html FROM schemes WHERE slug = ?", (slug,))
            row = cursor.fetchone()
            if row and row["total_html"]:
                return row["total_html"]
        return None

    def list_schemes(self) -> List[Dict[str, Any]]:
        """Returns all schemes stored in the SQL database (without heavy HTML fields for fast listing)."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, slug, scheme_name, short_title, ministry, level, category,
                   html_size_bytes, scraped_at, updated_at
            FROM schemes
            ORDER BY updated_at DESC
            """)
            return [dict(row) for row in cursor.fetchall()]

    def search_stored_schemes(self, query: str) -> List[Dict[str, Any]]:
        """Performs SQL search across stored scheme names, titles, tags, and descriptions."""
        pattern = f"%{query.strip().lower()}%"
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, slug, scheme_name, short_title, ministry, level, category,
                   html_size_bytes, scraped_at, updated_at
            FROM schemes
            WHERE LOWER(scheme_name) LIKE ?
               OR LOWER(slug) LIKE ?
               OR LOWER(short_title) LIKE ?
               OR LOWER(tags) LIKE ?
               OR LOWER(eligibility_criteria) LIKE ?
            ORDER BY updated_at DESC
            """, (pattern, pattern, pattern, pattern, pattern))
            return [dict(row) for row in cursor.fetchall()]

    def save_chat_interaction(
        self,
        session_id: str,
        user_query: str,
        matched_slug: Optional[str],
        scheme_name: Optional[str],
        eligibility_verdict: Optional[str],
        agent_response: str
    ) -> int:
        """Saves a conversation turn to the SQL database."""
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO chat_history (
                session_id, user_query, matched_slug, scheme_name,
                eligibility_verdict, agent_response, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (session_id, user_query, matched_slug, scheme_name, eligibility_verdict, agent_response, now_str))
            conn.commit()
            return cursor.lastrowid

    def get_chat_history(self, session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves chat messages for a specific session."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM chat_history
            WHERE session_id = ?
            ORDER BY id ASC
            LIMIT ?
            """, (session_id, limit))
            return [dict(row) for row in cursor.fetchall()]

    def get_db_stats(self) -> Dict[str, Any]:
        """Returns diagnostic statistics about the SQL database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) AS total FROM schemes")
            total_schemes = cursor.fetchone()["total"]

            cursor.execute("SELECT COUNT(*) AS total FROM chat_history")
            total_chats = cursor.fetchone()["total"]

            cursor.execute("SELECT SUM(html_size_bytes) AS total_bytes FROM schemes")
            total_html_bytes = cursor.fetchone()["total_bytes"] or 0

        file_size = os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0

        return {
            "db_path": self.db_path,
            "total_schemes": total_schemes,
            "total_chats": total_chats,
            "total_html_bytes": total_html_bytes,
            "db_file_size_bytes": file_size
        }
