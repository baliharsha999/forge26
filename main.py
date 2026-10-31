"""
Main entry point for Government Information RAG Application.
Runs FastAPI backend serving the LangGraph RAG pipeline.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment configuration (.env)
load_dotenv()

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(api_router)


@app.on_event("startup")
def startup_event():
    """Generate architecture diagrams and ensure database / index readiness on startup."""
    print("[Main] Initializing Government Information RAG System...")
    
    # LangSmith Tracing Verification
    ls_key = os.getenv("LANGCHAIN_API_KEY") or os.getenv("LANGSMITH_API_KEY")
    ls_project = os.getenv("LANGCHAIN_PROJECT") or os.getenv("LANGSMITH_PROJECT", "government-scheme-assistant")
    if ls_key:
        print(f"[Main] LangSmith Tracing Enabled -> Project: '{ls_project}'")
    else:
        print("[Main] LangSmith Tracing: Inactive (Set LANGCHAIN_API_KEY in .env)")

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
