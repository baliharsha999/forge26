"""
Main entry point for Government Information RAG Application.
Runs FastAPI backend serving the LangGraph RAG pipeline.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment configuration (.env)
load_dotenv()

# Prevent OpenMP / Tokenizer allocator deadlocks across Windows and Linux
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router
from app.graph.workflow import export_graph_visualizations

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

app = FastAPI(
    title="Advanced Government Information RAG System",
    description="Production-oriented RAG orchestrating query analysis, parallel hybrid retrieval, "
                "Reciprocal Rank Fusion, Cross-Encoder reranking, and LLM retrieval evaluation using LangGraph.",
    version="1.0.0"
)

# Enable CORS
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8001",
    "https://nagarik-ai.web.app",
    "https://nagarik-ai.firebaseapp.com",
    "https://cyugandharreddy08.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^chrome-extension://[a-z]{32}$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register routes
app.include_router(api_router)


@app.on_event("startup")
def startup_event():
    """Generate architecture diagrams, warm up embedding model, and ensure database / index readiness on startup."""
    print("[Main] Initializing Government Information RAG System...")
    
    # LangSmith Tracing Verification
    ls_key = os.getenv("LANGCHAIN_API_KEY") or os.getenv("LANGSMITH_API_KEY")
    ls_project = os.getenv("LANGCHAIN_PROJECT") or os.getenv("LANGSMITH_PROJECT", "government-scheme-assistant")
    if ls_key:
        print(f"[Main] LangSmith Tracing Enabled -> Project: '{ls_project}'")
    else:
        print("[Main] LangSmith Tracing: Inactive (Set LANGCHAIN_API_KEY in .env)")

    # Pre-warm embedding model to eliminate 30s cold start latency on first user query
    try:
        from app.ingestion.embeddings import EmbeddingService
        print("[Main] Pre-warming multilingual embedding model...")
        EmbeddingService.get_instance().model
        print("[Main] Multilingual embedding model ready in RAM!")
    except Exception as e:
        print(f"[Main] Embedding model pre-warm note: {e}")

    try:
        if os.getenv("EXPORT_GRAPHS", "false").lower() == "true":
            export_graph_visualizations()
    except Exception as e:
        print(f"[Main] Visualization export warning: {e}")
    print("[Main] Startup sequence complete. Ready to receive requests.")


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=False)
