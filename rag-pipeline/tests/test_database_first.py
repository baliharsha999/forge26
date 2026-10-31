"""
Comprehensive test suite for Database-First Retrieval with Conditional Web Scraping.
Covers:
TEST 1: Document in DB and indexed in FAISS -> direct hybrid retrieval, zero scraping.
TEST 2: Document in DB but not indexed in FAISS -> HTML retrieval + indexing, zero scraping.
TEST 3: Document not in DB -> web search, validation, scrape, store, and index.
TEST 4: URL exists but content changed -> update HTML, trigger reindex, no duplicate records.
TEST 5: Concurrent requests for same document -> thread safety & single ingestion.
TEST 6: Knowledge refinement triggers external discovery -> bounded to max 2 iterations.
TEST 7: Scraping failure / untrusted domain -> graceful fallback, no crash.
TEST 8: HTTP 304 Not Modified -> refresh timestamp, retain existing embeddings.
TEST 9: Canonical URL normalization and content hash deduplication.
"""

import os
import time
import threading
from typing import Dict, Any
from unittest.mock import patch, MagicMock
from langchain_core.documents import Document

from app.graph.state import RAGState
from app.agents.query_agent import QueryAnalysis
from app.ingestion.database import GovernmentDatabase
from app.retrieval.hnsw_index import FAISSHNSWIndex
from app.agents.scraping_agent import ScrapingAgent
from app.graph.nodes import (
    document_availability_check_node,
    web_search_node,
    url_validation_node,
    web_scraping_node,
    html_extraction_node,
    database_storage_node,
    html_retrieval_node,
    document_loading_node,
    document_chunking_node,
    embedding_generation_node,
    faiss_indexing_node,
    knowledge_refinement_node,
)
from app.graph.edges import (
    route_after_document_availability_check,
    route_after_knowledge_refinement,
)
import pytest


@pytest.fixture(autouse=True)
def clean_test_database():
    """Ensure test records are cleaned up before and after each test."""
    db = GovernmentDatabase()
    test_ids = [
        "test-scheme-unindexed",
        "new-unknown-scheme-2026",
        "pm-content-change-test",
        "concurrency-test",
        "http-304-test"
    ]
    with db.get_connection() as conn:
        conn.executemany("DELETE FROM government_documents WHERE document_id = ?", [(t,) for t in test_ids])
        conn.commit()
    yield
    with db.get_connection() as conn:
        conn.executemany("DELETE FROM government_documents WHERE document_id = ?", [(t,) for t in test_ids])
        conn.commit()



def test_canonical_url_normalization_and_hashing():
    """Verify URL canonicalization strips tracking params, fragments, ports, and normalizes casing."""
    url1 = "HTTPS://www.MyScheme.gov.in:443/schemes/pm-kisan/?utm_source=google&ref=123#overview"
    url2 = "https://www.myscheme.gov.in/schemes/pm-kisan"
    can1 = GovernmentDatabase.normalize_url(url1)
    can2 = GovernmentDatabase.normalize_url(url2)
    assert can1 == can2
    assert can1 == "https://www.myscheme.gov.in/schemes/pm-kisan"

    html_a = "  <div><h1>Pradhan Mantri Kisan</h1><p>Financial benefit 6000</p></div>  "
    html_b = "<div><h1>Pradhan Mantri Kisan</h1><p>Financial benefit 6000</p></div>"
    hash_a = GovernmentDatabase.hash_html(html_a)
    hash_b = GovernmentDatabase.hash_html(html_b)
    assert hash_a == hash_b


def test_case1_in_db_and_indexed_direct_retrieval():
    """TEST 1: When required document is in SQLite and FAISS, bypass all scraping and ingestion."""
    db = GovernmentDatabase()
    # pm-kisan is in DB and indexed in FAISS
    state = RAGState(
        original_query="What are the financial benefits under PM-Kisan scheme?",
        query_analysis=QueryAnalysis(
            original_query="What are the financial benefits under PM-Kisan scheme?",
            intent="benefits_inquiry",
            topic="pm-kisan",
            department="Department of Agriculture and Farmers Welfare",
            keywords=["pm-kisan", "financial", "benefits", "farmers"],
            entities=["PM-Kisan"],
            requires_current_info=False
        ),
        rewritten_queries=["pm-kisan financial benefits", "pm kisan installments"]
    )

    result = document_availability_check_node(state)
    updated_state = state.model_copy(update=result)

    assert updated_state.scraping_required is False
    assert len(updated_state.missing_documents) == 0
    assert len(updated_state.unindexed_document_ids) == 0
    assert "pm-kisan" in updated_state.indexed_document_ids
    assert len(updated_state.existing_documents) > 0

    route = route_after_document_availability_check(updated_state)
    assert route == "hybrid_retrieval_entry"


def test_case2_in_db_but_not_indexed():
    """TEST 2: Document exists in SQLite but is missing from FAISS index -> HTML ingestion without scraping."""
    db = GovernmentDatabase()
    test_slug = "test-scheme-unindexed"
    test_url = f"https://www.myscheme.gov.in/schemes/{test_slug}"
    html_content = "<html><body><h1>Test Scheme Unindexed</h1><p>Eligibility and benefits details for test.</p></body></html>"

    # Save to DB as unindexed
    db.save_document(
        document_id=test_slug,
        title="Test Scheme Unindexed",
        url=test_url,
        source_website="myscheme.gov.in",
        html_content=html_content,
        department="Ministry of Social Justice",
        category="Welfare",
        is_indexed=False
    )
    db.mark_document_unindexed(test_slug)

    state = RAGState(
        original_query="Information on test scheme unindexed",
        query_analysis=QueryAnalysis(
            original_query="Information on test scheme unindexed",
            intent="inquiry",
            topic=test_slug,
            department="Ministry of Social Justice",
            keywords=[test_slug, "unindexed", "test"],
            entities=[],
            requires_current_info=False
        ),
        rewritten_queries=[test_slug]
    )

    avail_res = document_availability_check_node(state)
    state = state.model_copy(update=avail_res)

    assert state.scraping_required is False
    assert test_slug in state.unindexed_document_ids

    # Routing must lead to html_retrieval, NOT web_search
    route = route_after_document_availability_check(state)
    assert route == "html_retrieval"

    # Execute subsequent ingestion nodes without scraping
    html_res = html_retrieval_node(state)
    state = state.model_copy(update=html_res)
    assert len(state.html_documents) > 0

    load_res = document_loading_node(state)
    state = state.model_copy(update=load_res)
    assert len(state.loaded_documents) > 0

    chunk_res = document_chunking_node(state)
    state = state.model_copy(update=chunk_res)
    assert len(state.chunks) > 0

    embed_res = embedding_generation_node(state)
    state = state.model_copy(update=embed_res)
    assert state.embeddings_status == "completed"

    index_res = faiss_indexing_node(state)
    state = state.model_copy(update=index_res)
    assert state.indexing_status.get(test_slug) is True

    # Check that database status is now marked as indexed
    doc_in_db = db.get_document_by_id(test_slug)
    assert doc_in_db["is_indexed"] == 1
    assert doc_in_db["chunk_count"] > 0


def test_case3_not_in_db_triggers_conditional_scraping():
    """TEST 3: When document is not in DB -> trigger web search, url validation, scrape, store, and index."""
    state = RAGState(
        original_query="How to apply for totally new unknown scheme 2026?",
        query_analysis=QueryAnalysis(
            original_query="How to apply for totally new unknown scheme 2026?",
            intent="application_process",
            topic="new-unknown-scheme-2026",
            department="Ministry of Unknown",
            keywords=["new-unknown-scheme-2026", "apply"],
            entities=[],
            requires_current_info=False
        ),
        rewritten_queries=["new unknown scheme 2026 apply"]
    )

    avail_res = document_availability_check_node(state)
    state = state.model_copy(update=avail_res)

    assert state.scraping_required is True
    assert len(state.missing_documents) > 0

    route = route_after_document_availability_check(state)
    assert route == "web_search"

    # Mock official web scraping response
    mock_url = "https://www.myscheme.gov.in/schemes/new-unknown-scheme-2026"
    mock_html = "<html><body><h1>New Unknown Scheme 2026</h1><p>Financial assistance of Rs 10000 to beneficiaries.</p></body></html>"

    with patch.object(ScrapingAgent, "search_sources", return_value=[mock_url]):
        search_res = web_search_node(state)
        state = state.model_copy(update=search_res)
        assert mock_url in state.discovered_urls

    val_res = url_validation_node(state)
    state = state.model_copy(update=val_res)
    assert mock_url in state.validated_urls

    with patch.object(ScrapingAgent, "scrape_url", return_value={
        "status": "success",
        "http_status": 200,
        "document_id": "new-unknown-scheme-2026",
        "title": "New Unknown Scheme 2026",
        "url": mock_url,
        "canonical_url": mock_url,
        "source_website": "myscheme.gov.in",
        "department": "Ministry of Unknown",
        "publication_date": "2026-01-01",
        "category": "Welfare",
        "html_content": mock_html,
        "content_hash": GovernmentDatabase.hash_html(mock_html),
        "etag": "tag123",
        "last_modified": "2026-01-01"
    }):
        scrape_res = web_scraping_node(state)
        state = state.model_copy(update=scrape_res)
        assert len(state.scraped_html) == 1

    extract_res = html_extraction_node(state)
    state = state.model_copy(update=extract_res)
    assert len(state.scraped_documents) == 1

    db_res = database_storage_node(state)
    state = state.model_copy(update=db_res)
    assert "new-unknown-scheme-2026" in state.unindexed_document_ids

    # Verify document stored in SQLite
    db = GovernmentDatabase()
    saved = db.get_document_by_id("new-unknown-scheme-2026")
    assert saved is not None
    assert saved["title"] == "New Unknown Scheme 2026"


def test_case4_url_exists_content_changed_reindexes_without_duplicates():
    """TEST 4: Existing URL with modified HTML content updates DB and triggers re-indexing without duplicate records."""
    db = GovernmentDatabase()
    slug = "pm-content-change-test"
    url = f"https://www.myscheme.gov.in/schemes/{slug}"

    old_html = "<html><body><h1>Original Content</h1><p>Assistance of 5000</p></body></html>"
    db.save_document(
        document_id=slug,
        title="Original Title",
        url=url,
        source_website="myscheme.gov.in",
        html_content=old_html,
        is_indexed=True
    )
    initial_count = db.count_documents()

    # New HTML with updated figures
    new_html = "<html><body><h1>Updated Content 2026</h1><p>Assistance revised to 8000</p></body></html>"
    new_hash = GovernmentDatabase.hash_html(new_html)

    state = RAGState(
        original_query="Update scheme",
        scraped_html=[{
            "document_id": slug,
            "title": "Updated Title",
            "url": url,
            "html_content": new_html,
            "department": "Ministry of Finance",
            "source_website": "myscheme.gov.in",
            "publication_date": "2026-02-01",
            "category": "Finance"
        }]
    )

    storage_res = database_storage_node(state)
    state = state.model_copy(update=storage_res)

    # Document count must NOT increase (no duplicate record)
    assert db.count_documents() == initial_count

    # Stored record must have updated HTML and content hash
    doc = db.get_document_by_id(slug)
    assert doc["content_hash"] == new_hash
    assert doc["is_indexed"] == 0  # Marked unindexed for re-indexing
    assert slug in state.unindexed_document_ids


def test_case5_concurrency_and_locking():
    """TEST 5: Concurrent requests for same missing URL acquire lock exclusively."""
    db = GovernmentDatabase()
    agent = ScrapingAgent(db=db)
    test_url = "https://www.myscheme.gov.in/schemes/concurrency-test"
    can_url = db.normalize_url(test_url)

    # Thread 1 acquires lock
    lock1 = db.acquire_ingestion_lock(can_url)
    assert lock1 is True

    # Thread 2 attempts lock while thread 1 holds it
    lock2 = db.acquire_ingestion_lock(can_url)
    assert lock2 is False

    # Scraping agent returns in_progress status when locked
    res = agent.scrape_url(test_url)
    assert res.get("status") == "in_progress"

    # Thread 1 releases lock
    db.release_ingestion_lock(can_url)

    # Now lock can be acquired again
    lock3 = db.acquire_ingestion_lock(can_url)
    assert lock3 is True
    db.release_ingestion_lock(can_url)


def test_case6_knowledge_refinement_triggers_discovery_bounded_loop():
    """TEST 6: Knowledge refinement triggers external query when gap detected, strictly bounded to max 2 loops."""
    # Attempt 0: insufficient context generates targeted refinement queries
    state = RAGState(
        original_query="What are the specific eligibility requirements for PM Street Vendors in rural areas?",
        retrieval_evaluation={"is_relevant": False, "relevance_score": 0.40, "sufficient_context": False},
        refinement_attempts=0
    )

    with patch("app.agents.refinement_agent.KnowledgeRefinementAgent.analyze_and_refine") as mock_refine:
        from app.agents.refinement_agent import RefinementAnalysis
        mock_refine.return_value = RefinementAnalysis(
            missing_aspects=["rural vendor eligibility"],
            targeted_queries=["PM SVANidhi rural eligibility criteria", "street vendor rural coverage"],
            strategy="expand_to_rural_rules"
        )
        res = knowledge_refinement_node(state)
        state = state.model_copy(update=res)

    assert state.refinement_attempts == 1
    assert len(state.knowledge_refinement_queries) > 0
    route1 = route_after_knowledge_refinement(state)
    assert route1 == "query_rewriting"

    # Attempt 1: refinement generates further query
    res2 = knowledge_refinement_node(state)
    state = state.model_copy(update=res2)
    assert state.refinement_attempts == 2

    # After 2 attempts, loop is strictly exhausted -> controlled fallback
    route2 = route_after_knowledge_refinement(state)
    assert route2 == "controlled_fallback"


def test_case7_scraping_untrusted_domain_and_failure_fallback():
    """TEST 7: Web scraping filters out non-government domains and handles network errors gracefully."""
    agent = ScrapingAgent()
    untrusted_urls = [
        "https://www.random-blog.com/schemes/pm-kisan",
        "https://phishing-site.org/gov/scheme",
        "https://www.myscheme.gov.in/schemes/valid-scheme"
    ]

    validated = agent.validate_urls(untrusted_urls)
    assert len(validated) == 1
    assert validated[0] == "https://www.myscheme.gov.in/schemes/valid-scheme"

    # Scraper failure returns error status without crashing
    with patch("urllib.request.urlopen", side_effect=Exception("Connection timed out")):
        res = agent.scraper.scrape_url_conditional("https://www.myscheme.gov.in/schemes/timed-out")
        assert res["status"] == "error"
        assert res["http_status"] == 500


def test_case8_http_304_not_modified_retains_embeddings():
    """TEST 8: Server HTTP 304 response updates last_verified_at timestamp and retains existing embeddings."""
    db = GovernmentDatabase()
    slug = "http-304-test"
    url = f"https://www.myscheme.gov.in/schemes/{slug}"

    db.save_document(
        document_id=slug,
        title="304 Test Scheme",
        url=url,
        source_website="myscheme.gov.in",
        html_content="<p>Static content</p>",
        is_indexed=True
    )
    db.mark_document_indexed(slug, chunk_count=5)

    # Explicitly set an earlier last_verified_at timestamp
    earlier_time = "2024-01-01T00:00:00"
    with db.get_connection() as conn:
        conn.execute("UPDATE government_documents SET last_verified_at = ? WHERE document_id = ?", (earlier_time, slug))
        conn.commit()

    initial_doc = db.get_document_by_id(slug)
    old_verified = initial_doc.get("last_verified_at")
    assert old_verified == earlier_time

    # Simulate HTTP 304 response from get_scraping_agent
    with patch("app.graph.nodes.get_scraping_agent") as mock_get_agent:
        mock_agent = MagicMock()
        mock_agent.scrape_url.return_value = {
            "status": "not_modified",
            "http_status": 304,
            "url": url,
            "canonical_url": url
        }
        mock_get_agent.return_value = mock_agent

        state = RAGState(
            original_query="Check 304",
            validated_urls=[url]
        )
        res = web_scraping_node(state)
        state = state.model_copy(update=res)

    updated_doc = db.get_document_by_id(slug)
    assert updated_doc["is_indexed"] == 1
    assert updated_doc["chunk_count"] == 5
    # Verification timestamp refreshed
    assert updated_doc["last_verified_at"] != old_verified
    assert updated_doc["last_verified_at"] > earlier_time

