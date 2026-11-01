"""
Source Verification Agent.
Verifies retrieved government documents for domain authority, issuing department legitimacy,
publication date currency, authenticity indicators, and assigns source reliability metadata.
"""

import urllib.parse
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.config.settings import get_settings


class SourceVerificationItem(BaseModel):
    """Metadata assessment for a single source document."""

    document_id: str
    title: str
    source_url: str
    is_official_domain: bool
    department: str
    is_department_verified: bool
    publication_date: str
    last_updated: str
    age_in_years: float
    is_outdated: bool
    reliability_score: float = Field(ge=0.0, le=1.0)
    status: str
    authenticity_notes: str


class SourceVerificationAgent:
    """Evaluates authority, domain ownership, and temporal currency of source documents."""

    def __init__(self):
        self.settings = get_settings()
        self.current_year = datetime.now().year

    def verify_single(self, doc_item: Dict[str, Any]) -> SourceVerificationItem:
        """Evaluates source authenticity and freshness for a single document chunk."""
        meta = doc_item.get("metadata", {})
        doc_id = meta.get("document_id", "unknown_doc")
        title = meta.get("title", "Untitled Document")
        url = meta.get("source_url") or meta.get("url", "")
        dept = meta.get("department", "Government of India")
        pub_date = str(meta.get("publication_date", ""))[:10]
        last_updated = str(meta.get("last_updated", ""))[:10]

        # 1. Domain verification
        parsed_url = urllib.parse.urlparse(url)
        host = parsed_url.netloc.lower()

        is_gov_domain = (
            host.endswith(".gov.in")
            or host.endswith(".nic.in")
            or host.endswith(".mygov.in")
            or any(host == td or host.endswith("." + td) for td in self.settings.TRUSTED_DOMAINS)
        )

        # Authoritative Registry of Official Ministries, Statutory Commissions, and Apex Civic Bodies
        OFFICIAL_MINISTRIES_REGISTRY = {
            "ministry of agriculture and farmers welfare", "ministry of civil aviation", "ministry of coal",
            "ministry of commerce and industry", "ministry of communications",
            "ministry of consumer affairs, food and public distribution", "ministry of corporate affairs",
            "ministry of culture", "ministry of defence", "ministry of development of north eastern region",
            "ministry of earth sciences", "ministry of education", "ministry of electronics and information technology",
            "ministry of environment, forest and climate change", "ministry of external affairs", "ministry of finance",
            "ministry of fisheries, animal husbandry and dairying", "ministry of food processing industries",
            "ministry of health and family welfare", "ministry of heavy industries", "ministry of home affairs",
            "ministry of housing and urban affairs", "ministry of information and broadcasting",
            "ministry of jal shakti", "ministry of labour and employment", "ministry of law and justice",
            "ministry of micro, small and medium enterprises", "ministry of mines", "ministry of minority affairs",
            "ministry of new and renewable energy", "ministry of panchayati raj", "ministry of parliamentary affairs",
            "ministry of personnel, public grievances and pensions", "ministry of petroleum and natural gas",
            "ministry of power", "ministry of railways", "ministry of road transport and highways",
            "ministry of rural development", "ministry of science and technology", "ministry of ports, shipping and waterways",
            "ministry of skill development and entrepreneurship", "ministry of social justice and empowerment",
            "ministry of statistics and programme implementation", "ministry of steel", "ministry of textiles",
            "ministry of tourism", "ministry of tribal affairs", "ministry of women and child development",
            "ministry of youth affairs and sports", "niti aayog", "unique identification authority of india", "uidai",
            "election commission of india", "national informatics centre", "nic",
            "department of agriculture and cooperation", "department of higher education",
            "department of school education and literacy", "department of telecommunications",
            "department of revenue", "department of expenditure", "department of financial services",
            "department of economic affairs", "employees provident fund organisation", "epfo",
            "employees state insurance corporation", "esic", "central board of direct taxes",
            "central board of indirect taxes and customs", "food safety and standards authority of india", "fssai",
            "national health authority", "nha", "municipal corporation"
        }

        # 2. Department legitimacy check against authoritative registry
        dept_clean = dept.strip().lower()
        is_dept_verified = any(
            dept_clean == entry or entry in dept_clean or dept_clean in entry
            for entry in OFFICIAL_MINISTRIES_REGISTRY
        ) and len(dept_clean) >= 4

        # Provenance verification separates domain ownership from document validity
        is_provenance_verified = bool(is_gov_domain and is_dept_verified and url and url != "Unknown Source")

        # 3. Document currency / age analysis
        date_str = last_updated or pub_date
        year = self.current_year
        if date_str:
            try:
                year = int(date_str[:4])
            except Exception:
                year = self.current_year

        age_years = max(0.0, float(self.current_year - year))
        is_outdated = age_years > 5.0  # Documents older than 5 years flagged for currency review

        # 4. Reliability scoring
        score = 0.5
        notes = []

        if is_gov_domain:
            score += 0.35
            notes.append("Official government domain confirmed.")
        else:
            score -= 0.20
            notes.append("Warning: Unverified third-party domain.")

        if is_dept_verified:
            score += 0.10
            notes.append(f"Recognized issuing authority: {dept}.")
        else:
            notes.append("Generic or unstated issuing department.")

        if is_outdated:
            score -= 0.15
            notes.append(f"Document dates back to {year} ({age_years:.1f} years old) - caution advised regarding policy currency.")
        else:
            score += 0.05
            notes.append(f"Recently updated/published ({year}).")

        final_score = round(min(1.0, max(0.0, score)), 2)

        if is_gov_domain and not is_outdated:
            status = "VERIFIED_OFFICIAL_CURRENT"
        elif is_gov_domain and is_outdated:
            status = "VERIFIED_OFFICIAL_OUTDATED"
        elif not is_gov_domain and final_score >= 0.5:
            status = "THIRD_PARTY_ACCREDITED"
        else:
            status = "UNVERIFIED_SOURCE"

        return SourceVerificationItem(
            document_id=doc_id,
            title=title,
            source_url=url,
            is_official_domain=is_gov_domain,
            department=dept,
            is_department_verified=is_dept_verified,
            publication_date=pub_date,
            last_updated=last_updated,
            age_in_years=age_years,
            is_outdated=is_outdated,
            reliability_score=final_score,
            status=status,
            authenticity_notes="; ".join(notes)
        )

    def verify_documents(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Processes and attaches verification items to each document chunk.
        Preserves all source metadata.
        """
        verified_results = []
        for doc in documents:
            v_item = self.verify_single(doc)
            # Attach verification to chunk dict
            doc_copy = dict(doc)
            doc_copy["source_verification"] = v_item.model_dump()
            verified_results.append(doc_copy)

        return verified_results
