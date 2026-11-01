"""
Pydantic State Model for LangGraph StateGraph.
Tracks complete workflow execution across query decomposition, rewriting,
database-first document availability checking, conditional web scraping & ingestion,
hybrid retrieval, knowledge refinement, contextual compression, multi-stage
evaluation (retrieval, answerability, faithfulness), and citation validation.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.agents.query_agent import QueryAnalysis


class RAGState(BaseModel):
    """LangGraph state representation for Government Information RAG workflow."""

    # 1. Query Analysis, Decomposition & Rewriting
    original_query: str = Field(default="", description="Original natural-language user query")
    query_analysis: Optional[QueryAnalysis] = Field(default=None, description="Structured query analysis")
    decomposed_queries: List[str] = Field(default_factory=list, description="Subqueries targeting distinct information requirements")
    rewritten_queries: List[str] = Field(default_factory=list, description="Targeted retrieval queries (semantic, keyword, dept, missing)")

    # 1b. Multilingual Language Detection, Normalization & Translation
    detected_language: str = Field(default="English", description="Identified language name (e.g. Hindi, Telugu, Tamil, Bengali, English)")
    language_code: str = Field(default="en", description="ISO 639-1 code (e.g. hi, te, ta, bn, en, mr, gu, kn, ml, pa, or, as, ur)")
    detected_script: str = Field(default="Latin", description="Script name (e.g. Devanagari, Telugu, Tamil, Bengali, Latin)")
    is_mixed_language: bool = Field(default=False, description="True if query contains multiple languages or code-switching")
    response_language: str = Field(default="auto", description="Target language requested or determined for final response")
    normalized_query: str = Field(default="", description="Spelling-corrected and normalized query interpretation in native script")
    translated_query: str = Field(default="", description="Faithfully translated English query for cross-lingual retrieval")
    multilingual_queries: List[str] = Field(default_factory=list, description="Alternative queries in original language and English")
    document_languages: Any = Field(default_factory=list, description="Detected language per document ID or list of languages")
    multilingual_retrieval_results: List[Dict[str, Any]] = Field(default_factory=list, description="Cross-lingual and native retrieval matches")
    original_context: Any = Field(default="", description="Context passages preserved in original language")
    translated_context: Any = Field(default=None, description="Context passages translated into user response language")
    context_language: str = Field(default="English", description="Primary language of the source documents")
    answer_language: str = Field(default="English", description="Language of the generated final answer")
    translation_status: str = Field(default="not_needed", description="Status of translation operations")
    language_confidence: float = Field(default=1.0, description="Confidence score of language detection (0.0 to 1.0)")
    multilingual_evaluation_result: Optional[Dict[str, Any]] = Field(default=None, description="Cross-lingual evaluation summary")

    # 2. Database-First Document Checking & Conditional Ingestion
    document_search_results: List[Dict[str, Any]] = Field(default_factory=list, description="Matches found in database during availability check")
    existing_documents: List[Dict[str, Any]] = Field(default_factory=list, description="Documents already stored in database")
    missing_documents: List[str] = Field(default_factory=list, description="Missing document queries or topics needing discovery")
    indexed_document_ids: List[str] = Field(default_factory=list, description="Document IDs confirmed present and indexed in FAISS")
    unindexed_document_ids: List[str] = Field(default_factory=list, description="Document IDs in database needing embedding/FAISS indexing")
    scraping_required: bool = Field(default=False, description="Whether web scraping is necessary")
    scraping_results: List[Dict[str, Any]] = Field(default_factory=list, description="Outputs from web scraping stage")
    discovered_urls: List[str] = Field(default_factory=list, description="Raw URLs discovered from external search")
    validated_urls: List[str] = Field(default_factory=list, description="Whitelisted canonical URLs approved for scraping")
    scraped_html: List[Dict[str, Any]] = Field(default_factory=list, description="Raw or cleaned HTML payloads from web scraping")
    document_hashes: Dict[str, str] = Field(default_factory=dict, description="SHA-256 hashes of scraped document contents")
    database_storage_results: List[Dict[str, Any]] = Field(default_factory=list, description="Status of database upsert/insert operations")
    indexing_status: Dict[str, bool] = Field(default_factory=dict, description="Status of FAISS indexing per document")
    newly_indexed_documents: List[str] = Field(default_factory=list, description="Documents newly embedded and added to FAISS")

    # Ingestion Artifacts & Backward Compatibility
    search_results: List[Dict[str, Any]] = Field(default_factory=list, description="Discovered source links")
    scraped_documents: List[Dict[str, Any]] = Field(default_factory=list, description="Scraped raw documents")
    document_ids: List[str] = Field(default_factory=list, description="IDs of documents being processed")
    html_documents: List[Dict[str, Any]] = Field(default_factory=list, description="HTML payloads from database")
    loaded_documents: List[Dict[str, Any]] = Field(default_factory=list, description="Loaded LangChain documents")
    chunks: List[Dict[str, Any]] = Field(default_factory=list, description="Text chunks with preserved metadata")
    embeddings_status: str = Field(default="pending", description="Status of vector embeddings generation")
    is_ingestion_needed: bool = Field(default=False, description="Whether on-demand web ingestion was triggered")

    # 3. Hybrid Retrieval & Ranking
    retrieved_documents: List[Dict[str, Any]] = Field(default_factory=list, description="Merged retrieved document chunks")
    vector_results: List[Dict[str, Any]] = Field(default_factory=list, description="Dense FAISS HNSW retrieval results")
    bm25_results: List[Dict[str, Any]] = Field(default_factory=list, description="Sparse BM25 retrieval results")
    fused_results: List[Dict[str, Any]] = Field(default_factory=list, description="Combined RRF results")
    reranked_documents: List[Dict[str, Any]] = Field(default_factory=list, description="Cross-Encoder reranked documents")
    is_degraded_retrieval: bool = Field(default=False, description="Flag indicating if vector embeddings are degraded")
    retrieval_mode: str = Field(default="hybrid_hnsw_bm25", description="Active retrieval engine mode")

    # 4. Source Verification & Contextual Compression
    source_verification_results: List[Dict[str, Any]] = Field(default_factory=list, description="Document authenticity and date verification scores")
    compressed_context: List[Dict[str, Any]] = Field(default_factory=list, description="Extracted concise paragraphs preserving facts and figures")

    # 5. Multi-Stage Evaluation & Refinement Loops
    retrieval_evaluation: Optional[Dict[str, Any]] = Field(default=None, description="Relevance evaluation of retrieved documents")
    evaluation_result: Optional[Dict[str, Any]] = Field(default=None, description="Alias for retrieval_evaluation")
    knowledge_refinement_queries: List[str] = Field(default_factory=list, description="Targeted queries generated for missing aspects")
    refinement_attempts: int = Field(default=0, description="Counter for iterative knowledge refinement loops (max 2)")
    answerability_result: Optional[Dict[str, Any]] = Field(default=None, description="Assessment of whether context is sufficient to answer")

    # 6. Generation, Faithfulness & Citation Validation
    generation_attempts: int = Field(default=0, description="Counter for generation attempts (max 2)")
    evaluator_feedback: Optional[str] = Field(default=None, description="Feedback from faithfulness evaluation to guide regeneration")
    faithfulness_result: Optional[Dict[str, Any]] = Field(default=None, description="Claim verification against retrieved context")
    citation_validation_result: Optional[Dict[str, Any]] = Field(default=None, description="Verification that all citations are genuine")

    # 7. Final Outputs & Guardrails
    guardrail_result: Optional[Dict[str, Any]] = Field(default=None, description="Security and safety guardrail evaluation")
    is_blocked: bool = Field(default=False, description="True if query was blocked by input safety guardrails")
    final_answer: str = Field(default="", description="Verified answer or controlled failure statement")
    citations: List[Dict[str, Any]] = Field(default_factory=list, description="Official source citations with URLs and departments")
    error: Optional[str] = Field(default=None, description="Error message if any step failed")
