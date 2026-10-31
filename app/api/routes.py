"""
FastAPI REST API endpoints for Government Information RAG System.
Provides /chat, /ingest, /documents, /graph, and /health endpoints.
"""

import os
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from app.graph.workflow import build_query_retrieval_graph, build_ingestion_graph
from app.graph.state import RAGState
from app.ingestion.database import GovernmentDatabase
from app.retrieval.hnsw_index import FAISSHNSWIndex
from app.retrieval.bm25_retriever import GovernmentBM25Retriever
from app.agents.scraping_agent import ScrapingAgent


router = APIRouter()
db = GovernmentDatabase()
scraping_agent = ScrapingAgent(db=db)
query_graph = build_query_retrieval_graph()
ingestion_graph = build_ingestion_graph()


# Request / Response Models matching Section 19 & Multilingual Upgrades

class ChatRequest(BaseModel):
    query: str = Field(..., example="రైతులకు ప్రభుత్వం ఇచ్చే సబ్సిడీలు ఏమిటి?")
    response_language: Optional[str] = Field("auto", description="Preferred response language (e.g. 'auto', 'Telugu', 'Hindi', 'English')")


class SourceItem(BaseModel):
    title: str
    department: str
    url: str
    publication_date: str


class RetrievalEvaluationSummary(BaseModel):
    is_relevant: bool
    relevance_score: float
    sufficient_context: Optional[bool] = None
    reason: Optional[str] = None


class ChatResponse(BaseModel):
    query: str
    answer: str
    sources: List[SourceItem]
    retrieval_evaluation: RetrievalEvaluationSummary
    detected_language: Optional[str] = "English"
    language_code: Optional[str] = "en"
    detected_script: Optional[str] = "Latin"
    response_language: Optional[str] = "English"
    translated_query: Optional[str] = None


class IngestUrlRequest(BaseModel):
    url: str = Field(..., example="https://www.myscheme.gov.in/schemes/pmegp")


class IngestResponse(BaseModel):
    status: str
    message: str
    total_chunks: int


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Main Multilingual RAG endpoint for answering user queries using official government documents.
    Executes LangGraph query workflow: Language Detection -> Query Normalization ->
    Multilingual Expansion & Translation -> Parallel Hybrid Search -> RRF -> Cross-Encoder Rerank
    -> Context Understanding -> Answer Generation with Citations in target language.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    initial_state = RAGState(
        original_query=request.query.strip(),
        response_language=request.response_language or "auto"
    )
    final_state = query_graph.invoke(initial_state)

    eval_data = final_state.get("retrieval_evaluation") or final_state.get("evaluation_result") or {
        "is_relevant": False,
        "relevance_score": 0.0,
        "sufficient_context": False,
        "reason": "Evaluation unavailable."
    }

    sources = [
        SourceItem(
            title=c.get("title", "Official Source"),
            department=c.get("department", "Government of India"),
            url=c.get("url", ""),
            publication_date=c.get("publication_date", "")[:10]
        )
        for c in final_state.get("citations", [])
    ]

    return ChatResponse(
        query=request.query,
        answer=final_state.get("final_answer", ""),
        sources=sources,
        retrieval_evaluation=RetrievalEvaluationSummary(
            is_relevant=eval_data.get("is_relevant", False),
            relevance_score=eval_data.get("relevance_score", 0.0),
            sufficient_context=eval_data.get("sufficient_context"),
            reason=eval_data.get("reason")
        ),
        detected_language=final_state.get("detected_language", "English"),
        language_code=final_state.get("language_code", "en"),
        detected_script=final_state.get("detected_script", "Latin"),
        response_language=final_state.get("response_language", "English"),
        translated_query=final_state.get("translated_query")
    )


@router.post("/ingest", response_model=IngestResponse)
async def ingest_database_documents():
    """
    Triggers the reusable document ingestion workflow over all documents in the SQLite database.
    Loads HTML, splits chunks, generates SentenceTransformer embeddings, and updates FAISS HNSW + BM25.
    """
    initial_state = RAGState(original_query="Ingest all database documents")
    res = ingestion_graph.invoke(initial_state)
    chunks_count = len(res.get("chunks", []))
    return IngestResponse(
        status="success",
        message="Document ingestion and HNSW + BM25 indexing completed successfully.",
        total_chunks=chunks_count
    )


@router.post("/ingest/url")
async def ingest_url(request: IngestUrlRequest, background_tasks: BackgroundTasks):
    """
    Scrapes a new official government URL, stores it in the database,
    and runs the ingestion pipeline.
    """
    doc = scraping_agent.scrape_direct_url(request.url)
    if not doc:
        raise HTTPException(status_code=400, detail="Failed to scrape or unauthorized non-government URL.")

    # Run ingestion to update HNSW and BM25 index
    res = ingestion_graph.invoke(RAGState(original_query=f"Ingest {request.url}"))
    return {
        "status": "success",
        "document_id": doc["document_id"],
        "title": doc["title"],
        "url": doc["url"],
        "total_chunks_indexed": len(res.get("chunks", []))
    }


@router.get("/documents")
async def list_documents():
    """Lists all verified government documents stored in the database."""
    docs = db.fetch_all_documents()
    return {
        "total": len(docs),
        "documents": [
            {
                "document_id": d["document_id"],
                "title": d["title"],
                "department": d["department"],
                "category": d["category"],
                "url": d["url"],
                "canonical_url": d.get("canonical_url"),
                "is_indexed": bool(d.get("is_indexed")),
                "index_status": d.get("index_status", "pending"),
                "chunk_count": d.get("chunk_count", 0),
                "last_scraped_at": d.get("last_scraped_at"),
                "last_verified_at": d.get("last_verified_at"),
                "last_updated": d["last_updated"]
            }
            for d in docs
        ]
    }


@router.get("/graph")
async def get_graph_mermaid():
    """Returns the Mermaid diagram of the LangGraph architecture."""
    return {
        "query_workflow": query_graph.get_graph().draw_mermaid(),
        "ingestion_workflow": ingestion_graph.get_graph().draw_mermaid()
    }


@router.get("/health")
async def health_check():
    """Returns system status, model information, and index counts."""
    from app.config.settings import get_settings
    settings = get_settings()
    hnsw = FAISSHNSWIndex()
    hnsw.load()
    bm25 = GovernmentBM25Retriever()

    return {
        "status": "healthy",
        "total_documents_in_db": db.count_documents(),
        "faiss_hnsw_vectors": hnsw.total_vectors,
        "bm25_documents_indexed": len(bm25.documents),
        "embedding_model": settings.EMBEDDING_MODEL_NAME,
        "reranker_model": settings.RERANKING_MODEL_NAME,
        "supported_languages": settings.SUPPORTED_LANGUAGES
    }
