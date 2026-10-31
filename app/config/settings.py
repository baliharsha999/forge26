import os
from functools import lru_cache
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # LLM Settings
    GROQ_API_KEY: str = Field(default="", description="API key for Groq Cloud")
    GROQ_MODEL: str = Field(default="openai/gpt-oss-120b", description="Primary LLM on Groq")
    FALLBACK_MODEL: str = Field(default="openai/gpt-oss-20b", description="Fallback LLM on Groq")
    GEMINI_API_KEY: Optional[str] = Field(default=None, description="API key for Google Gemini if used")

    # Embedding & Reranking Models
    EMBEDDING_MODEL_NAME: str = Field(
        default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        description="Multilingual HuggingFace model for dense cross-lingual embeddings"
    )
    RERANKING_MODEL_NAME: str = Field(
        default="cross-encoder/ms-marco-MiniLM-L-6-v2",
        description="Cross-Encoder model for reranking"
    )

    # Multilingual Capabilities
    SUPPORTED_LANGUAGES: list[str] = Field(
        default=[
            "English", "Hindi", "Telugu", "Bengali", "Tamil", "Kannada",
            "Malayalam", "Marathi", "Gujarati", "Punjabi", "Odia", "Assamese", "Urdu"
        ],
        description="Officially supported Indian and international languages"
    )
    DEFAULT_RESPONSE_LANGUAGE: str = Field(
        default="auto",
        description="Default response language: 'auto' (mirrors user input) or specific language name"
    )

    # LangSmith Observability & Tracing
    LANGCHAIN_TRACING_V2: bool = Field(default=True, description="Enable LangSmith Tracing V2")
    LANGCHAIN_API_KEY: Optional[str] = Field(default=None, description="LangSmith / LangChain API Key")
    LANGCHAIN_PROJECT: str = Field(default="government-scheme-assistant", description="LangSmith project name")
    LANGSMITH_TRACING: bool = Field(default=True, description="Enable LangSmith tracing flag")
    LANGSMITH_API_KEY: Optional[str] = Field(default=None, description="LangSmith API key")
    LANGSMITH_PROJECT: str = Field(default="government-scheme-assistant", description="LangSmith project name")
    LANGCHAIN_ENDPOINT: str = Field(default="https://api.smith.langchain.com", description="LangSmith endpoint")

    # Storage Paths & Engine Selection
    VECTOR_DB_TYPE: str = Field(default="faiss", description="Vector database engine: 'faiss' or 'chroma'")
    CHROMA_PERSIST_DIR: str = Field(default="data/chroma_db", description="ChromaDB persistence directory")
    LOW_MEMORY_MODE: bool = Field(default=False, description="Optimize memory for 512MB RAM on Render Free Tier")
    DB_PATH: str = Field(default="schemes.db", description="SQLite database path")
    FAISS_INDEX_DIR: str = Field(default="data/faiss_index", description="Directory to persist FAISS HNSW index")
    RAW_DATA_DIR: str = Field(default="data/raw", description="Directory for raw HTML dumps")
    PROCESSED_DATA_DIR: str = Field(default="data/processed", description="Directory for processed documents")

    # Document Processing Parameters
    CHUNK_SIZE: int = Field(default=1000, description="Chunk size for RecursiveCharacterTextSplitter")
    CHUNK_OVERLAP: int = Field(default=200, description="Chunk overlap for RecursiveCharacterTextSplitter")

    # FAISS HNSW Parameters
    HNSW_M: int = Field(default=32, description="Number of bi-directional links created for each new element")
    HNSW_EF_CONSTRUCTION: int = Field(default=64, description="Size of dynamic list during HNSW construction")
    HNSW_EF_SEARCH: int = Field(default=32, description="Size of dynamic candidate list during HNSW search")

    # Retrieval & Ranking Parameters
    VECTOR_TOP_K: int = Field(default=10, description="Number of dense vector search results")
    BM25_TOP_K: int = Field(default=10, description="Number of sparse BM25 search results")
    RRF_K: int = Field(default=60, description="Constant k used in Reciprocal Rank Fusion formula")
    RERANK_INPUT_TOP_K: int = Field(default=20, description="Top-k candidates passed into Cross-Encoder reranker")
    FINAL_TOP_K: int = Field(default=5, description="Final number of top reranked documents to feed generator")

    # Evaluation Parameters
    EVALUATION_THRESHOLD: float = Field(
        default=0.75,
        description="Minimum relevance score threshold for retrieval evaluator to proceed to answer generation"
    )

    # Trusted Government Domains
    TRUSTED_DOMAINS: list[str] = Field(
        default=[
            "myscheme.gov.in",
            "data.gov.in",
            "india.gov.in",
            "pib.gov.in",
            "msme.gov.in",
            "pmkisan.gov.in",
            "pmaymis.gov.in",
            "wcd.gov.in",
            "pmmodi.gov.in"
        ],
        description="Whitelisted official government domains"
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
