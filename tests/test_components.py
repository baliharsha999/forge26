"""
Unit tests for independent system components:
Database, Loader, TextSplitter, FAISS HNSW, BM25, RRF, CrossEncoder, Evaluator.
"""

import pytest
import numpy as np
from langchain_core.documents import Document

from app.ingestion.database import GovernmentDatabase
from app.ingestion.html_loader import GovernmentHTMLLoader
from app.ingestion.document_processor import GovernmentDocumentProcessor
from app.retrieval.hnsw_index import FAISSHNSWIndex
from app.retrieval.bm25_retriever import GovernmentBM25Retriever
from app.retrieval.rrf import reciprocal_rank_fusion
from app.agents.evaluation_agent import RetrievalEvaluationAgent


def test_database_initialization_and_sync():
    """Verify database initialization and document counting."""
    db = GovernmentDatabase()
    count = db.count_documents()
    assert count >= 1, "Database should contain at least 1 verified scheme."
    docs = db.fetch_all_documents()
    assert len(docs) == count
    assert "document_id" in docs[0]
    assert "html_content" in docs[0]


def test_html_loader_and_markdown_preservation():
    """Verify HTML cleaning preserves headings and strips navigation."""
    raw_html = """
    <html>
      <nav><a href="#">Nav Bar</a></nav>
      <body>
        <h1>National Scheme</h1>
        <p>This is official scheme text.</p>
        <div class="advertisement">Ad banner</div>
      </body>
    </html>
    """
    loader = GovernmentHTMLLoader()
    cleaned = loader.clean_html_to_markdown(raw_html)
    assert "# National Scheme" in cleaned
    assert "Nav Bar" not in cleaned
    assert "Ad banner" not in cleaned


def test_document_processor_metadata_preservation():
    """Verify that document chunking preserves all metadata fields."""
    doc = Document(
        page_content="Government scheme guidelines. " * 150,
        metadata={
            "document_id": "test_doc",
            "title": "Test Title",
            "source_url": "https://india.gov.in/test",
            "department": "Ministry of Electronics"
        }
    )
    processor = GovernmentDocumentProcessor(chunk_size=200, chunk_overlap=50)
    chunks = processor.split_documents([doc])
    assert len(chunks) > 1
    for chunk in chunks:
        assert chunk.metadata["document_id"] == "test_doc"
        assert chunk.metadata["title"] == "Test Title"
        assert chunk.metadata["source_url"] == "https://india.gov.in/test"
        assert "chunk_id" in chunk.metadata


def test_faiss_hnsw_indexing_and_search(tmp_path):
    """Verify FAISS IndexHNSWFlat vector addition and nearest neighbor retrieval."""
    dim = 384
    test_dir = str(tmp_path / "test_faiss")
    hnsw = FAISSHNSWIndex(dimension=dim, m=16, ef_construction=32, ef_search=16, index_dir=test_dir)
    docs = [
        Document(page_content=f"Doc content {i}", metadata={"chunk_id": f"c_{i}"})
        for i in range(5)
    ]
    vecs = np.random.randn(5, dim).astype(np.float32)
    assigned_ids = hnsw.add_documents(docs, vecs)
    assert len(assigned_ids) == 5
    assert hnsw.total_vectors == 5

    # Query with first vector
    results = hnsw.similarity_search_with_score(vecs[0], top_k=2)
    assert len(results) == 2
    assert results[0][0].metadata["chunk_id"] == "c_0"
    assert results[0][1] >= 0.99  # Cosine similarity close to 1.0


def test_reciprocal_rank_fusion():
    """Verify RRF formula calculation and duplicate deduplication."""
    doc_a = Document(page_content="Doc A", metadata={"chunk_id": "doc_a"})
    doc_b = Document(page_content="Doc B", metadata={"chunk_id": "doc_b"})
    doc_c = Document(page_content="Doc C", metadata={"chunk_id": "doc_c"})

    # Dense ranked: A (rank 1), B (rank 2)
    dense_res = [(doc_a, 0.95), (doc_b, 0.85)]
    # BM25 ranked: B (rank 1), C (rank 2)
    bm25_res = [(doc_b, 12.5), (doc_c, 8.2)]

    fused = reciprocal_rank_fusion(dense_res, bm25_res, k=60)
    # Doc B appeared in both lists, so its score is 1/(60+2) + 1/(60+1)
    # Doc A has score 1/(60+1)
    # Doc C has score 1/(60+2)
    # B should be top ranked!
    assert fused[0]["chunk_id"] == "doc_b"
    assert fused[0]["rrf_score"] > fused[1]["rrf_score"]
    assert len(fused) == 3


def test_retrieval_evaluator_decision_rule():
    """Verify conditional edge decision rule for retrieval evaluation."""
    eval_agent = RetrievalEvaluationAgent()

    # Pass case
    class DummyEval:
        is_relevant = True
        sufficient_context = True
        relevance_score = 0.90

    assert eval_agent.is_sufficient_for_generation(DummyEval(), threshold=0.75) is True

    # Fail case - insufficient context
    class DummyFail1:
        is_relevant = True
        sufficient_context = False
        relevance_score = 0.85

    assert eval_agent.is_sufficient_for_generation(DummyFail1(), threshold=0.75) is False

    # Fail case - low score
    class DummyFail2:
        is_relevant = True
        sufficient_context = True
        relevance_score = 0.60

    assert eval_agent.is_sufficient_for_generation(DummyFail2(), threshold=0.75) is False
