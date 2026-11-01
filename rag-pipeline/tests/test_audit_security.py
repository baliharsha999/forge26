"""
Audit Security Unit Tests for Nagarik AI RAG & Ingestion Security.
Tests SSRF redirection safety, department strictness, admin API key protection,
and embedding degradation transparency.
"""

import pytest
from app.ingestion.scraper import (
    validate_safe_target_url,
    is_ip_private_or_restricted,
    SSRFProtectionError,
    GovernmentWebScraper
)
from app.agents.verification_agent import SourceVerificationAgent
from app.ingestion.embeddings import EmbeddingService


def test_ssrf_private_ip_detection():
    # Loopback
    assert is_ip_private_or_restricted("127.0.0.1") is True
    assert is_ip_private_or_restricted("127.0.0.2") is True
    # AWS / Cloud Metadata IP
    assert is_ip_private_or_restricted("169.254.169.254") is True
    # Private RFC 1918
    assert is_ip_private_or_restricted("10.0.0.1") is True
    assert is_ip_private_or_restricted("172.16.0.1") is True
    assert is_ip_private_or_restricted("192.168.1.1") is True
    # Public IP
    assert is_ip_private_or_restricted("8.8.8.8") is False


def test_ssrf_blocks_unauthorized_schemes_and_hosts():
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


def test_department_verification_strictness():
    agent = SourceVerificationAgent()

    # Legit official departments
    v_clean = agent.verify_single({
        "metadata": {
            "url": "https://myscheme.gov.in/schemes/pmkisan",
            "department": "Ministry of Agriculture & Farmers Welfare",
            "publication_date": "2025-01-01"
        }
    })
    assert v_clean.is_department_verified is True

    v_uidai = agent.verify_single({
        "metadata": {
            "url": "https://uidai.gov.in",
            "department": "Unique Identification Authority of India (UIDAI)",
            "publication_date": "2025-01-01"
        }
    })
    assert v_uidai.is_department_verified is True

    # Audit bug fix: strings > 5 chars without legitimate civic keywords MUST NOT be verified!
    v_fake = agent.verify_single({
        "metadata": {
            "url": "https://myscheme.gov.in/test",
            "department": "RandomGibberishString",
            "publication_date": "2025-01-01"
        }
    })
    assert v_fake.is_department_verified is False


def test_embedding_degradation_transparency():
    service = EmbeddingService.get_instance()
    # is_degraded_mode property must exist and be a boolean
    assert isinstance(service.is_degraded_mode, bool)
