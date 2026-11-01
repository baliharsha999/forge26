import pytest
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.services.rag_service import NagarikSchemesRAG, PureBM25Retriever, tokenize_civic_text

client = TestClient(app)

def test_pure_bm25_retriever():
    retriever = PureBM25Retriever()
    corpus = [
        {"title": "PM Kisan Samman Nidhi", "content": "Income support of 6000 rupees per year for small and marginal farmers across India."},
        {"title": "Ayushman Bharat PM-JAY", "content": "Health insurance cover of 5 lakh rupees per family per year for secondary and tertiary care hospitalisation."},
        {"title": "Pradhan Mantri Awas Yojana", "content": "Financial assistance for construction of pucca houses for eligible urban and rural poor families."}
    ]
    retriever.fit(corpus, text_fields=["title", "content"])
    
    # Farmer query
    results = retriever.search("farmer income support 6000", top_k=2)
    assert len(results) > 0
    top_doc, score = results[0]
    assert "PM Kisan" in top_doc["title"]
    assert score > 0
    
    # Health query
    results_health = retriever.search("health insurance 5 lakh hospital", top_k=2)
    assert len(results_health) > 0
    top_health_doc, _ = results_health[0]
    assert "Ayushman" in top_health_doc["title"]

def test_multilingual_expansion_and_rag():
    rag = NagarikSchemesRAG.get_instance()
    
    # Telugu query
    te_response = asyncio.run(rag.answer_citizen_query("రైతులకు సబ్సిడీ ఏమిటి?"))
    assert te_response.language_code in ["te", "en", "hi"] or te_response.detected_language in ["Telugu", "Hindi", "English"]
    assert len(te_response.answer) > 0
    assert len(te_response.sources) > 0
    
    # English query
    en_response = asyncio.run(rag.answer_citizen_query("What is the annual benefit under PM-KISAN?"))
    assert "6,000" in en_response.answer or "6000" in en_response.answer or "kisan" in en_response.answer.lower()
    assert any("pmkisan.gov.in" in s.url or "gov.in" in s.url for s in en_response.sources)

def test_chat_api_endpoints():
    # POST /api/v1/chat with 'message'
    payload = {"message": "How to get housing assistance under PMAY?", "language": "en"}
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "citations" in data
    assert len(data["citations"]) > 0
    assert "grounded_score" in data
    assert data["grounded_score"] >= 0.8

    # POST /api/v1/schemes/chat with alternative 'query' field
    payload2 = {"query": "Tell me about Ayushman Bharat health card", "language": "en"}
    response2 = client.post("/api/v1/schemes/chat", json=payload2)
    assert response2.status_code == 200
    data2 = response2.json()
    assert "answer" in data2
    assert len(data2["citations"]) > 0

def test_extension_download_endpoint():
    response = client.get("/api/v1/extension/download")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/zip"
    assert int(response.headers.get("content-length", 0)) > 1000
