"""
LangChain Document Loader for Government HTML Documents.
Extracts clean structural text while preserving headings, lists, tables, and document metadata.
"""

import re
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
from langchain_core.documents import Document


class GovernmentHTMLLoader:
    """Loads and converts raw Government HTML documents into LangChain Document instances."""

    def __init__(self, remove_selectors: Optional[List[str]] = None):
        self.remove_selectors = remove_selectors or [
            "nav", "footer", "header", "script", "style", "noscript",
            ".navbar", ".footer", ".nav", ".menu", ".sidebar", ".advertisement",
            ".cookie-banner", "#header", "#footer", "#nav"
        ]

    def clean_html_to_markdown(self, html_content: str) -> str:
        """
        Parses HTML and transforms structural elements (headings, lists, bold)
        into clean, markdown-style structured plain text.
        """
        if not html_content:
            return ""

        soup = BeautifulSoup(html_content, "html.parser")

        # Strip unneeded navigation, script, and advertisement tags
        for selector in self.remove_selectors:
            for el in soup.select(selector):
                el.decompose()

        # Preserve structural markers before extracting text
        for h1 in soup.find_all("h1"):
            h1.replace_with(f"\n# {h1.get_text().strip()}\n")
        for h2 in soup.find_all("h2"):
            h2.replace_with(f"\n## {h2.get_text().strip()}\n")
        for h3 in soup.find_all("h3"):
            h3.replace_with(f"\n### {h3.get_text().strip()}\n")
        for h4 in soup.find_all(["h4", "h5", "h6"]):
            h4.replace_with(f"\n#### {h4.get_text().strip()}\n")
        for li in soup.find_all("li"):
            li.replace_with(f"\n- {li.get_text().strip()}")
        for p in soup.find_all("p"):
            p.replace_with(f"\n{p.get_text().strip()}\n")

        # Extract text and normalize excess whitespace
        raw_text = soup.get_text()
        lines = [line.strip() for line in raw_text.splitlines()]
        cleaned = "\n".join(line for line in lines if line)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def load_from_db_record(self, record: Dict[str, Any]) -> Document:
        """Converts a database row dictionary into a LangChain Document with metadata."""
        html = record.get("html_content") or ""
        cleaned_text = self.clean_html_to_markdown(html)

        # In case cleaned_text is very sparse, prepend title and department
        title = record.get("title", "Government Scheme")
        dept = record.get("department", "Government of India")
        header = f"# {title}\n**Department**: {dept}\n\n"
        if not cleaned_text.startswith("#"):
            cleaned_text = header + cleaned_text

        metadata = {
            "document_id": str(record.get("document_id", "")),
            "title": str(record.get("title", "")),
            "source_url": str(record.get("url", "")),
            "department": str(record.get("department", "Government of India")),
            "category": str(record.get("category", "General")),
            "publication_date": str(record.get("publication_date", "")),
            "last_updated": str(record.get("last_updated", "")),
            "source_website": str(record.get("source_website", "gov.in")),
            "language": str(record.get("language", "English")),
            "language_code": str(record.get("language_code", "en")),
            "script": str(record.get("script", "Latin")),
            "is_multilingual": bool(record.get("is_multilingual", False)),
            "source_language": str(record.get("source_language", record.get("language", "English"))),
        }

        return Document(page_content=cleaned_text, metadata=metadata)

    def load_from_records(self, records: List[Dict[str, Any]]) -> List[Document]:
        """Converts multiple database rows into LangChain Document objects."""
        documents = []
        for rec in records:
            doc = self.load_from_db_record(rec)
            if doc.page_content:
                documents.append(doc)
        return documents

    def load_file(self, file_path: str, metadata: Optional[Dict[str, Any]] = None) -> Document:
        """Loads HTML from a local file path."""
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            html = f.read()

        cleaned_text = self.clean_html_to_markdown(html)
        meta = metadata or {}
        return Document(page_content=cleaned_text, metadata=meta)
