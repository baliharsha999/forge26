"""
API tests for FastAPI endpoints (/health, /documents, /chat, /graph).
"""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify /health returns 200 OK and index statistics."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "total_documents_in_db" in data
    assert "faiss_hnsw_vectors" in data
    assert "bm25_documents_indexed" in data


def test_documents_endpoint():
    """Verify /documents lists government documents stored in SQLite."""
    response = client.get("/documents")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "documents" in data
    assert len(data["documents"]) > 0


def test_graph_endpoint():
    """Verify /graph returns Mermaid diagram definitions for LangGraph workflows."""
    response = client.get("/graph")
    assert response.status_code == 200
    data = response.json()
    assert "query_workflow" in data
    assert "ingestion_workflow" in data
    assert "graph TD" in data["query_workflow"]


def test_chat_endpoint_in_domain():
    """Verify /chat returns structured answer, sources, and evaluation for valid query."""
    response = client.post(
        "/chat",
        json={"query": "What financial benefits and assistance are provided to farmers under PM-KISAN scheme?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "answer" in data
    assert "sources" in data
    assert "retrieval_evaluation" in data
    assert data["retrieval_evaluation"]["is_relevant"] is True
    assert len(data["sources"]) > 0
