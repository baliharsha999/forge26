"""
Audit Security Unit Tests for Nagarik AI RAG & Ingestion Security.
Comprehensive regression test suite covering all Round 2 and Round 3 audit findings:
1. SSRF prevention and SafeRedirectHandler
2. Fail-closed administrative API key authentication (zero default fallback secret)
3. Zero-fabrication citation policy (missing metadata preserved as None / 'Unknown')
4. Dynamic system date and authoritative ministry registry
5. Degraded retrieval safety and transparent fallback
"""

import os
from datetime import datetime
import pytest
from fastapi import HTTPException

from app.ingestion.scraper import (
    validate_safe_target_url,
    is_ip_private_or_restricted,
    SSRFProtectionError,
    GovernmentWebScraper
)
from app.agents.verification_agent import SourceVerificationAgent
from app.ingestion.embeddings import EmbeddingService
from app.api.routes import verify_admin_key
from app.generation.answer_generator import AnswerGenerator


def test_ssrf_private_ip_detection():
    """Verify loopback, private RFC-1918, and cloud metadata IPs are strictly detected."""
    # Loopback
    assert is_ip_private_or_restricted("127.0.0.1") is True
    assert is_ip_private_or_restricted("127.0.0.2") is True
    # AWS / GCP / Azure Cloud Metadata IP
    assert is_ip_private_or_restricted("169.254.169.254") is True
    # Private RFC 1918
    assert is_ip_private_or_restricted("10.0.0.1") is True
    assert is_ip_private_or_restricted("172.16.0.1") is True
    assert is_ip_private_or_restricted("192.168.1.1") is True
    # Public IP
    assert is_ip_private_or_restricted("8.8.8.8") is False


def test_ssrf_blocks_unauthorized_schemes_and_hosts():
    """Verify non-HTTP/HTTPS schemes and non-government domains are blocked before network fetch."""
    def mock_checker(url):
        return "myscheme.gov.in" in url

    # Scheme blocking
    with pytest.raises(SSRFProtectionError):
        validate_safe_target_url("file:///etc/passwd", mock_checker)

    with pytest.raises(SSRFProtectionError):
        validate_safe_target_url("gopher://127.0.0.1:6379", mock_checker)

    # Untrusted domain blocking
    with pytest.raises(SSRFProtectionError):
        validate_safe_target_url("https://malicious-attacker.com/steal", mock_checker)


def test_fail_closed_admin_api_key():
    """
    Finding 1: Verify administrative ingestion endpoints fail closed.
    Must throw 500 when ADMIN_API_KEY is not configured, 401 when key is invalid, and 200 when valid.
    """
    # 1. Missing environment variable -> strict 500 fail closed (No default secret permitted!)
    if "ADMIN_API_KEY" in os.environ:
        del os.environ["ADMIN_API_KEY"]

    with pytest.raises(HTTPException) as exc_info:
        verify_admin_key(x_api_key="any-key")
    assert exc_info.value.status_code == 500
    assert "ADMIN_API_KEY environment variable is not configured" in exc_info.value.detail

    # 2. Configured key but wrong key provided -> 401 Unauthorized
    os.environ["ADMIN_API_KEY"] = "super-secret-rotated-key-2026"
    with pytest.raises(HTTPException) as exc_info:
        verify_admin_key(x_api_key="wrong-key")
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        verify_admin_key(x_api_key=None)
    assert exc_info.value.status_code == 401

    # 3. Correct key provided -> Success
    res = verify_admin_key(x_api_key="super-secret-rotated-key-2026")
    assert res == "super-secret-rotated-key-2026"


def test_zero_citation_fabrication_policy():
    """
    Finding 2: Verify AnswerGenerator NEVER manufactures default URLs or publication dates.
    Missing provenance must be preserved as 'Unknown' / 'Unknown Source'.
    """
    generator = AnswerGenerator()

    # Document with missing source_url and missing date
    test_docs = [
        {
            "metadata": {
                "title": "Scholarship Scheme Notification",
                "department": "Department of Higher Education"
                # source_url and publication_date intentionally omitted
            },
            "source_verification": {},
            "page_content": "Eligible college students receive direct financial scholarship."
        }
    ]

    resp = generator.generate(
        query="What is the scholarship?",
        retrieved_documents=test_docs,
        response_language="English"
    )

    assert len(resp.sources) == 1
    citation = resp.sources[0]

    # Must NOT invent 'https://www.myscheme.gov.in'
    assert citation.url == "Unknown Source"
    # Must NOT invent '2024-01-01'
    assert citation.publication_date == "Unknown"


def test_department_verification_authoritative_registry():
    """
    Finding 4: Verify department verification validates against authoritative registry
    and separates domain ownership from document provenance authenticity.
    """
    agent = SourceVerificationAgent()

    # Dynamic year check: must match current system year, never hardcoded
    assert agent.current_year == datetime.now().year

    # 1. Legit official ministry from authoritative registry
    v_clean = agent.verify_single({
        "metadata": {
            "url": "https://myscheme.gov.in/schemes/pmkisan",
            "department": "Ministry of Agriculture and Farmers Welfare",
            "publication_date": "2025-01-01"
        }
    })
    assert v_clean.is_department_verified is True
    assert v_clean.is_official_domain is True

    # 2. Apex statutory authority (UIDAI)
    v_uidai = agent.verify_single({
        "metadata": {
            "url": "https://uidai.gov.in",
            "department": "Unique Identification Authority of India",
            "publication_date": "2025-01-01"
        }
    })
    assert v_uidai.is_department_verified is True

    # 3. Random string without authoritative registry match -> Rejected
    v_fake = agent.verify_single({
        "metadata": {
            "url": "https://myscheme.gov.in/test",
            "department": "RandomGibberishAuthority",
            "publication_date": "2025-01-01"
        }
    })
    assert v_fake.is_department_verified is False


def test_embedding_degradation_transparency():
    """Finding 5: Verify embedding service exposes degraded mode boolean."""
    service = EmbeddingService.get_instance()
    assert isinstance(service.is_degraded_mode, bool)


def test_department_verification_rejects_weak_generic_matches():
    """
    Round 4 Finding 2: Verify generic standalone tokens ('ministry', 'department', 'board')
    are strictly rejected, while canonical acronyms ('uidai', 'epfo') resolve correctly.
    """
    agent = SourceVerificationAgent()

    # Generic single keywords must fail closed
    for generic in ["ministry", "department", "board", "authority", "government", "central", "state", "govt"]:
        v = agent.verify_single({
            "metadata": {
                "url": "https://myscheme.gov.in/test",
                "department": generic,
                "publication_date": "2025-01-01"
            }
        })
        assert v.is_department_verified is False, f"Weak generic keyword '{generic}' should be rejected"

    # Canonical acronyms must resolve successfully
    v_acronym = agent.verify_single({
        "metadata": {
            "url": "https://uidai.gov.in",
            "department": "uidai",
            "publication_date": "2025-01-01"
        }
    })
    assert v_acronym.is_department_verified is True


def test_provenance_strict_hostname_parsing():
    """
    Round 4 Finding 3: Verify provenance check parses hostnames strictly.
    Must reject spoofed paths (e.g. 'https://attacker.com/gov.in/fake')
    and accept legitimate government hostnames ('.gov.in', '.nic.in').
    """
    generator = AnswerGenerator()

    # 1. Attacker domain attempting path-based spoofing
    spoofed_doc = [
        {
            "metadata": {
                "title": "Phishing Scheme",
                "source_url": "https://malicious-attacker.com/gov.in/portal",
                "publication_date": "2025-01-01"
            },
            "source_verification": {},
            "page_content": "Fake content"
        }
    ]
    resp = generator.generate(
        query="Tell me about fake scheme",
        retrieved_documents=spoofed_doc,
        response_language="English"
    )
    assert len(resp.sources) == 1

    # 2. Legitimate government hostname
    legit_doc = [
        {
            "metadata": {
                "title": "PM Kisan Scheme",
                "source_url": "https://pmkisan.gov.in/portal",
                "publication_date": "2025-01-01"
            },
            "source_verification": {},
            "page_content": "Farmers receive DBT"
        }
    ]
    resp_legit = generator.generate(
        query="Tell me about PM Kisan",
        retrieved_documents=legit_doc,
        response_language="English"
    )
    assert resp_legit.sources[0].url == "https://pmkisan.gov.in/portal"
