"""
LangGraph Nodes for Government Information RAG System.
Features:
- Query Analysis & Query Decomposition
- Advanced Multi-Strategy Query Rewriting
- Database-First Document Availability Checking (DB availability + FAISS index availability)
- Conditional Web Search, URL Validation & Whitelisting, Scraping, Extraction, and Storage
- Concurrency Locking & Content Hash Deduplication
- Reusable HTML Document Loading, Chunking, Embedding Generation, and FAISS HNSW Indexing
- Parallel Hybrid Dense FAISS HNSW + Sparse BM25 Retrieval
- Reciprocal Rank Fusion & Cross-Encoder Reranking
- LLM Retrieval Evaluation (Relevance)
- Source Verification (Domain, Authority, Age)
- Knowledge Refinement (Iterative Gap Analysis & Refined Subqueries)
- Contextual Compression (Fact/Figure/Date Preservation)
- Answerability Evaluation (Completeness & Sufficiency)
- Grounded Answer Generation (with feedback & conflict resolution)
- Faithfulness Evaluation (Hallucination Detection)
- Citation Validation (Provenance verification against database)
"""

from typing import Dict, Any, List, Optional
from langchain_core.documents import Document

from app.graph.state import RAGState
from app.config.settings import get_settings
from app.agents.query_agent import QueryAnalysisAgent
from app.agents.decomposition_agent import QueryDecompositionAgent
from app.agents.language_agent import LanguageAgent
from app.agents.normalization_agent import QueryNormalizationAgent
from app.agents.multilingual_query_agent import MultilingualQueryAgent
from app.agents.scraping_agent import ScrapingAgent
from app.agents.verification_agent import SourceVerificationAgent
from app.agents.refinement_agent import KnowledgeRefinementAgent
from app.agents.evaluation_agent import RetrievalEvaluationAgent
from app.retrieval.contextual_compressor import ContextualCompressor
from app.retrieval.context_understanding import ContextUnderstandingService
from app.evaluation.answerability_eval import AnswerabilityEvaluator
from app.evaluation.faithfulness_eval import FaithfulnessEvaluator
from app.evaluation.citation_eval import CitationValidator
from app.ingestion.database import GovernmentDatabase
from app.ingestion.html_loader import GovernmentHTMLLoader
from app.ingestion.document_processor import GovernmentDocumentProcessor
from app.ingestion.embeddings import EmbeddingService
from app.retrieval.hnsw_index import FAISSHNSWIndex
from app.retrieval.faiss_store import FAISSHNSWVectorStore
from app.retrieval.bm25_retriever import GovernmentBM25Retriever
from app.retrieval.rrf import reciprocal_rank_fusion
from app.retrieval.reranker import GovernmentReranker
from app.generation.answer_generator import AnswerGenerator
from app.security.guardrails import GovernmentRAGGuardrails


# Lazy instance cache
_instances: Dict[str, Any] = {}


def get_query_agent() -> QueryAnalysisAgent:
    if "query_agent" not in _instances:
        _instances["query_agent"] = QueryAnalysisAgent()
    return _instances["query_agent"]


def get_language_agent() -> LanguageAgent:
    if "language_agent" not in _instances:
        _instances["language_agent"] = LanguageAgent()
    return _instances["language_agent"]


def get_normalization_agent() -> QueryNormalizationAgent:
    if "normalization_agent" not in _instances:
        _instances["normalization_agent"] = QueryNormalizationAgent()
    return _instances["normalization_agent"]


def get_multilingual_query_agent() -> MultilingualQueryAgent:
    if "multilingual_query_agent" not in _instances:
        _instances["multilingual_query_agent"] = MultilingualQueryAgent()
    return _instances["multilingual_query_agent"]


def get_context_understanding_service() -> ContextUnderstandingService:
    if "context_understanding" not in _instances:
        _instances["context_understanding"] = ContextUnderstandingService.get_instance()
    return _instances["context_understanding"]


def get_decomp_agent() -> QueryDecompositionAgent:
    if "decomp_agent" not in _instances:
        _instances["decomp_agent"] = QueryDecompositionAgent()
    return _instances["decomp_agent"]


def get_db() -> GovernmentDatabase:
    if "db" not in _instances:
        _instances["db"] = GovernmentDatabase()
    return _instances["db"]


def get_scraping_agent() -> ScrapingAgent:
    if "scraping_agent" not in _instances:
        _instances["scraping_agent"] = ScrapingAgent(db=get_db())
    return _instances["scraping_agent"]


def get_verification_agent() -> SourceVerificationAgent:
    if "verification_agent" not in _instances:
        _instances["verification_agent"] = SourceVerificationAgent()
    return _instances["verification_agent"]


def get_refinement_agent() -> KnowledgeRefinementAgent:
    if "refinement_agent" not in _instances:
        _instances["refinement_agent"] = KnowledgeRefinementAgent()
    return _instances["refinement_agent"]


def get_compressor() -> ContextualCompressor:
    if "compressor" not in _instances:
        _instances["compressor"] = ContextualCompressor()
    return _instances["compressor"]


def get_answerability_eval() -> AnswerabilityEvaluator:
    if "answerability_eval" not in _instances:
        _instances["answerability_eval"] = AnswerabilityEvaluator()
    return _instances["answerability_eval"]


def get_faithfulness_eval() -> FaithfulnessEvaluator:
    if "faithfulness_eval" not in _instances:
        _instances["faithfulness_eval"] = FaithfulnessEvaluator()
    return _instances["faithfulness_eval"]


def get_citation_validator() -> CitationValidator:
    if "citation_validator" not in _instances:
        _instances["citation_validator"] = CitationValidator(db=get_db())
    return _instances["citation_validator"]


def get_html_loader() -> GovernmentHTMLLoader:
    if "html_loader" not in _instances:
        _instances["html_loader"] = GovernmentHTMLLoader()
    return _instances["html_loader"]


def get_doc_processor() -> GovernmentDocumentProcessor:
    if "doc_processor" not in _instances:
        _instances["doc_processor"] = GovernmentDocumentProcessor()
    return _instances["doc_processor"]


def get_embedding_service() -> EmbeddingService:
    if "embedding_service" not in _instances:
        _instances["embedding_service"] = EmbeddingService.get_instance()
    return _instances["embedding_service"]


def get_hnsw_index() -> Any:
    settings = get_settings()
    if settings.VECTOR_DB_TYPE.lower() in ("chroma", "chromadb"):
        if "chroma_store" not in _instances:
            from app.retrieval.chroma_store import ChromaVectorStore
            _instances["chroma_store"] = ChromaVectorStore.get_instance()
        return _instances["chroma_store"]

    if "hnsw_index" not in _instances:
        idx = FAISSHNSWIndex(dimension=get_embedding_service().dimension)
        idx.load()
        _instances["hnsw_index"] = idx
    return _instances["hnsw_index"]


def get_vector_store() -> FAISSHNSWVectorStore:
    if "vector_store" not in _instances:
        _instances["vector_store"] = FAISSHNSWVectorStore(
            hnsw_index=get_hnsw_index(),
            embedding_service=get_embedding_service()
        )
    return _instances["vector_store"]


def get_bm25_retriever() -> GovernmentBM25Retriever:
    if "bm25_retriever" not in _instances:
        _instances["bm25_retriever"] = GovernmentBM25Retriever()
    return _instances["bm25_retriever"]


def get_reranker() -> GovernmentReranker:
    if "reranker" not in _instances:
        _instances["reranker"] = GovernmentReranker.get_instance()
    return _instances["reranker"]


def get_eval_agent() -> RetrievalEvaluationAgent:
    if "eval_agent" not in _instances:
        _instances["eval_agent"] = RetrievalEvaluationAgent()
    return _instances["eval_agent"]


def get_answer_gen() -> AnswerGenerator:
    if "answer_gen" not in _instances:
        _instances["answer_gen"] = AnswerGenerator()
    return _instances["answer_gen"]


# ----------------------------------------------------
# 00. Security and Safety Guardrails Node
# ----------------------------------------------------

def input_guardrail_node(state: RAGState) -> Dict[str, Any]:
    """
    Security & Safety Guardrail:
    Thwarts prompt injections, jailbreaks, system overrides, toxic/abusive inputs,
    and demographic bias queries. Automatically redacts sensitive citizen PII (Aadhaar, PAN, phone).
    Blocks out-of-domain queries instantly (< 1ms), returning a safe refusal message and skipping downstream nodes.
    """
    guard_res = GovernmentRAGGuardrails.check_input_guardrail(state.original_query)
    if not guard_res.passed:
        return {
            "is_blocked": True,
            "guardrail_result": guard_res.model_dump(),
            "final_answer": guard_res.refusal_message,
            "citations": [],
            "retrieval_evaluation": {
                "is_relevant": False,
                "relevance_score": 0.0,
                "sufficient_context": False,
                "reason": f"Query blocked by security guardrails ({guard_res.flagged_category})."
            }
        }
    return {
        "is_blocked": False,
        "original_query": guard_res.sanitized_query,
        "guardrail_result": guard_res.model_dump()
    }


# ----------------------------------------------------
# 0. Multilingual Understanding & Translation Nodes
# ----------------------------------------------------

def language_detection_node(state: RAGState) -> Dict[str, Any]:
    """
    Automatically detects user query language, ISO code, script,
    mixed-language/code-switching status, and preferred response language.
    """
    agent = get_language_agent()
    det = agent.detect(state.original_query)
    # If state already had an explicit response_language preference (e.g. from API header), keep it
    target_resp_lang = state.response_language if state.response_language and state.response_language.lower() != "auto" else det.response_language

    return {
        "detected_language": det.detected_language,
        "language_code": det.language_code,
        "detected_script": det.script,
        "is_mixed_language": det.is_mixed_language,
        "response_language": target_resp_lang,
        "language_confidence": det.confidence,
        "answer_language": target_resp_lang
    }


def query_normalization_node(state: RAGState) -> Dict[str, Any]:
    """
    Normalizes typos, Romanized Indic queries (e.g. Hinglish/Tenglish),
    and expands government acronyms.
    Fast-paths English queries to eliminate redundant LLM latency.
    """
    # Latency optimization: English queries in Latin script bypass LLM normalization
    if (state.detected_language or "").lower() == "english" and (state.detected_script or "").lower() in ("latin", "none", ""):
        return {"normalized_query": state.original_query}

    agent = get_normalization_agent()
    norm = agent.normalize(
        query=state.original_query,
        detected_language=state.detected_language,
        detected_script=state.detected_script
    )
    return {
        "normalized_query": norm.normalized_query
    }


def multilingual_query_expansion_node(state: RAGState) -> Dict[str, Any]:
    """
    Generates multi-strategy expansions across native and English terms
    while preserving official scheme names and numerical constraints.
    Fast-paths English queries.
    """
    eff_query = state.normalized_query or state.original_query
    # Latency optimization: English queries already have English keywords
    if (state.detected_language or "").lower() == "english":
        return {"multilingual_queries": [eff_query]}

    agent = get_multilingual_query_agent()
    expansions = agent.expand_multilingual(
        query=eff_query,
        detected_language=state.detected_language,
        detected_script=state.detected_script
    )
    return {
        "multilingual_queries": expansions
    }


def query_translation_node(state: RAGState) -> Dict[str, Any]:
    """
    Translates non-English queries to clear English for cross-lingual document retrieval
    while strictly preserving official scheme names, departments, and amounts.
    Fast-paths English queries.
    """
    eff_query = state.normalized_query or state.original_query
    # Latency optimization: Skip LLM translation if query is already English
    if (state.detected_language or "").lower() == "english":
        return {
            "translated_query": eff_query,
            "translation_status": "already_english"
        }

    agent = get_multilingual_query_agent()
    trans = agent.translate_to_english(
        query=eff_query,
        source_language=state.detected_language
    )
    return {
        "translated_query": trans.translated_query,
        "translation_status": trans.translation_status
    }


# ----------------------------------------------------
# 1. Query Analysis, Decomposition & Rewriting Nodes
# ----------------------------------------------------

def query_analysis_node(state: RAGState) -> Dict[str, Any]:
    """Analyzes the query for intent, topic, department, and entities using translated or normalized query."""
    try:
        agent = get_query_agent()
        analysis_target = state.translated_query or state.normalized_query or state.original_query
        analysis = agent.analyze(analysis_target)
        return {
            "query_analysis": analysis,
            "rewritten_queries": analysis.rewritten_queries or [analysis_target]
        }
    except Exception as e:
        return {
            "error": f"Error in query_analysis_node: {e}",
            "rewritten_queries": [state.original_query]
        }


def query_decomposition_node(state: RAGState) -> Dict[str, Any]:
    """
    Decomposes the query into smaller atomic subqueries covering all information requirements.
    Fast-paths concise single-focus queries (<= 14 words) to reduce Groq latency by 8-10s.
    """
    decomp_target = state.translated_query or state.normalized_query or state.original_query
    words = decomp_target.split()
    complex_markers = ["compare", "difference between", "versus", " vs ", "both "]
    is_complex = any(m in decomp_target.lower() for m in complex_markers)

    if len(words) <= 14 and not is_complex:
        return {
            "decomposed_queries": [
                decomp_target,
                f"{decomp_target} eligibility",
                f"{decomp_target} benefits"
            ]
        }

    agent = get_decomp_agent()
    decomp = agent.decompose(decomp_target)
    return {
        "decomposed_queries": decomp.subqueries
    }


def query_rewriting_node(state: RAGState) -> Dict[str, Any]:
    """
    Advanced multi-strategy query rewriting:
    Combines semantic, keyword-dense, alternative, department-specific queries,
    along with cross-lingual translations and multilingual expansions.
    Fast-paths when rewritten queries already exist to eliminate redundant Groq call.
    """
    rewrite_target = state.translated_query or state.normalized_query or state.original_query

    # Latency optimization: If query_analysis and decomposition already produced variations,
    # assemble all_queries without an extra 3.5s LLM rewrite round-trip
    if state.rewritten_queries and not state.knowledge_refinement_queries:
        all_queries = list(dict.fromkeys(
            [rewrite_target, state.original_query] +
            (state.rewritten_queries or []) +
            (state.decomposed_queries or []) +
            (state.multilingual_queries or [])
        ))
        return {"rewritten_queries": all_queries}

    agent = get_query_agent()
    dept = state.query_analysis.department if state.query_analysis else None
    missing = state.knowledge_refinement_queries

    rewriting = agent.rewrite_advanced(
        query=rewrite_target,
        department=dept,
        decomposed_queries=state.decomposed_queries,
        missing_aspects=missing
    )

    all_queries = list(rewriting.all_queries)
    if state.original_query not in all_queries:
        all_queries.append(state.original_query)
    if state.translated_query and state.translated_query not in all_queries:
        all_queries.append(state.translated_query)
    if state.multilingual_queries:
        for mq in state.multilingual_queries:
            if mq not in all_queries:
                all_queries.append(mq)

    return {
        "rewritten_queries": all_queries
    }


# ----------------------------------------------------
# 2. Database-First Document Checking Node
# ----------------------------------------------------

def document_availability_check_node(state: RAGState) -> Dict[str, Any]:
    """
    Checks database availability and vector store availability independently:
    A. Database availability: Does the relevant HTML document exist in SQLite?
    B. Vector store availability: Is the document processed, embedded, and present in FAISS?
    Determines whether scraping or ingestion is necessary.
    """
    db = get_db()
    hnsw = get_hnsw_index()

    # Collect search keywords from query analysis and rewritten queries
    keywords: List[str] = []
    dept: Optional[str] = None
    if state.query_analysis:
        keywords.extend(state.query_analysis.keywords or [])
        keywords.extend(state.query_analysis.entities or [])
        if state.query_analysis.topic:
            keywords.append(state.query_analysis.topic)
        dept = state.query_analysis.department

    query_sources = [state.original_query]
    if state.translated_query:
        query_sources.append(state.translated_query)
    if state.rewritten_queries:
        query_sources.extend(state.rewritten_queries)

    for q in query_sources:
        for term in q.split():
            clean_term = term.strip("?,.:;\"'()[]{}").lower()
            if len(clean_term) > 3 and clean_term not in {"what", "when", "where", "which", "about", "government", "india", "scheme", "schemes", "under"}:
                keywords.append(clean_term)

    keywords = list(dict.fromkeys(keywords))

    # Search existing database
    matched_docs = db.search_documents(keywords=keywords, department=dept, limit=5)

    existing_docs: List[Dict[str, Any]] = []
    indexed_doc_ids: List[str] = []
    unindexed_doc_ids: List[str] = []
    search_summaries: List[Dict[str, Any]] = []

    for doc in matched_docs:
        doc_id = doc["document_id"]
        existing_docs.append(doc)
        has_vectors = hnsw.has_document_chunks(doc_id)
        is_flagged_indexed = bool(doc.get("is_indexed"))

        if is_flagged_indexed and has_vectors:
            indexed_doc_ids.append(doc_id)
            search_summaries.append({
                "document_id": doc_id,
                "title": doc.get("title"),
                "status": "indexed_in_faiss",
                "in_db": True,
                "in_faiss": True
            })
        else:
            unindexed_doc_ids.append(doc_id)
            search_summaries.append({
                "document_id": doc_id,
                "title": doc.get("title"),
                "status": "in_db_not_indexed",
                "in_db": True,
                "in_faiss": False
            })

    # Missing documents & scraping determination
    missing_docs: List[str] = []
    scraping_required = False

    total_db_docs = db.count_documents()
    total_faiss_chunks = getattr(hnsw, "total_vectors", 0)

    if not existing_docs:
        # Latency optimization: If database or FAISS has indexed knowledge,
        # prefer semantic hybrid retrieval over blocking external web scraping.
        if total_db_docs > 0 or total_faiss_chunks > 0:
            scraping_required = False
        else:
            scraping_required = True
            missing_docs.append(state.original_query)
    elif state.knowledge_refinement_queries and state.refinement_attempts > 0:
        # Never trigger blocking web scrape during refinement loops
        scraping_required = False

    return {
        "document_search_results": search_summaries,
        "existing_documents": existing_docs,
        "missing_documents": missing_docs,
        "indexed_document_ids": indexed_doc_ids,
        "unindexed_document_ids": unindexed_doc_ids,
        "scraping_required": scraping_required,
        "document_ids": [d["document_id"] for d in existing_docs]
    }


# ----------------------------------------------------
# 3. Conditional Scraping & Storage Nodes
# ----------------------------------------------------

def web_search_node(state: RAGState) -> Dict[str, Any]:
    """
    Discovers candidate official government URLs for missing queries or topics.
    """
    agent = get_scraping_agent()
    queries_to_search = state.missing_documents or [state.original_query]
    dept = state.query_analysis.department if state.query_analysis else None

    discovered_urls: List[str] = list(state.discovered_urls)
    for q in queries_to_search[:2]:
        urls = agent.search_sources(query=q, department=dept, max_results=3)
        for u in urls:
            if u not in discovered_urls:
                discovered_urls.append(u)

    return {"discovered_urls": discovered_urls}


def url_validation_node(state: RAGState) -> Dict[str, Any]:
    """
    Validates discovered URLs against official domain whitelists and canonicalizes them.
    """
    agent = get_scraping_agent()
    validated = agent.validate_urls(state.discovered_urls)
    return {"validated_urls": validated}


def web_scraping_node(state: RAGState) -> Dict[str, Any]:
    """
    Fetches official HTML with concurrency locking and HTTP 304 conditional validation.
    """
    agent = get_scraping_agent()
    db = get_db()
    urls_to_scrape = state.validated_urls or state.discovered_urls

    scraped_html_list: List[Dict[str, Any]] = []
    doc_hashes: Dict[str, str] = dict(state.document_hashes)
    scraping_results: List[Dict[str, Any]] = []

    for url in (urls_to_scrape or [])[:1]:
        existing_doc = db.get_document_by_url(url)
        etag = existing_doc.get("etag") if existing_doc else None
        last_mod = existing_doc.get("http_last_modified") if existing_doc else None

        res = agent.scrape_url(url, etag=etag, last_modified=last_mod)
        scraping_results.append(res)

        if res.get("status") == "success":
            scraped_html_list.append(res)
            doc_hashes[res["document_id"]] = res.get("content_hash", "")
        elif res.get("status") == "not_modified":
            if existing_doc:
                db.update_document_verification(existing_doc["document_id"])

    return {
        "scraped_html": scraped_html_list,
        "document_hashes": doc_hashes,
        "scraping_results": scraping_results
    }


def html_extraction_node(state: RAGState) -> Dict[str, Any]:
    """
    Validates extracted HTML content and metadata before database insertion.
    """
    cleaned_docs: List[Dict[str, Any]] = []
    for doc in state.scraped_html:
        if doc.get("html_content"):
            cleaned_docs.append(doc)
    return {"scraped_documents": cleaned_docs}


def database_storage_node(state: RAGState) -> Dict[str, Any]:
    """
    Stores or updates scraped documents into SQLite with canonical URLs and SHA-256 hashes.
    Performs duplicate detection:
    - If URL and content hash unchanged -> avoids re-embedding.
    - If URL exists but content changed -> updates HTML, marks unindexed.
    - If new URL -> inserts document, marks unindexed.
    """
    db = get_db()
    storage_results: List[Dict[str, Any]] = []
    unindexed = list(state.unindexed_document_ids)

    for doc in state.scraped_html or state.scraped_documents:
        url = doc.get("url", "")
        can_url = db.normalize_url(url)
        content = doc.get("html_content", "")
        content_hash = db.hash_html(content)
        doc_id = doc.get("document_id") or can_url.split("/")[-1]

        dup_check = db.check_document_duplicate(can_url, content_hash)

        if dup_check["exists"] and not dup_check["content_changed"]:
            db.update_document_verification(doc_id)
            storage_results.append({
                "document_id": doc_id,
                "status": "unchanged_duplicate",
                "reindex_required": False
            })
            if not dup_check["is_indexed"] and doc_id not in unindexed:
                unindexed.append(doc_id)
        else:
            db.save_document(
                document_id=doc_id,
                title=doc.get("title", doc_id),
                url=url,
                source_website=doc.get("source_website", "gov.in"),
                html_content=content,
                department=doc.get("department"),
                publication_date=doc.get("publication_date"),
                category=doc.get("category"),
                etag=doc.get("etag"),
                http_last_modified=doc.get("last_modified"),
                is_indexed=False
            )
            if doc_id not in unindexed:
                unindexed.append(doc_id)
            storage_results.append({
                "document_id": doc_id,
                "status": "updated" if dup_check["exists"] else "inserted",
                "reindex_required": True
            })

    return {
        "database_storage_results": storage_results,
        "unindexed_document_ids": unindexed,
        "document_ids": list(set(state.document_ids + unindexed))
    }


# ----------------------------------------------------
# 4. Processing & Indexing Nodes (Reusable)
# ----------------------------------------------------

def html_retrieval_node(state: RAGState) -> Dict[str, Any]:
    """Fetches full HTML payloads and metadata for unindexed documents from SQLite."""
    db = get_db()
    target_ids = state.unindexed_document_ids or state.document_ids or None
    raw_html_docs = db.fetch_html_documents(target_ids)
    return {"html_documents": raw_html_docs}


def document_loading_node(state: RAGState) -> Dict[str, Any]:
    """Converts raw HTML records into clean structured LangChain documents."""
    loader = get_html_loader()
    docs = loader.load_from_records(state.html_documents)
    serialized = [
        {"page_content": d.page_content, "metadata": d.metadata}
        for d in docs
    ]
    return {"loaded_documents": serialized}


def document_chunking_node(state: RAGState) -> Dict[str, Any]:
    """Splits loaded documents into chunks with RecursiveCharacterTextSplitter, preserving metadata."""
    langchain_docs = [
        Document(page_content=d["page_content"], metadata=d["metadata"])
        for d in state.loaded_documents
    ]
    processor = get_doc_processor()
    chunks = processor.split_documents(langchain_docs)
    serialized_chunks = [
        {"page_content": c.page_content, "metadata": c.metadata}
        for c in chunks
    ]
    return {"chunks": serialized_chunks}


def embedding_generation_node(state: RAGState) -> Dict[str, Any]:
    """Generates dense vector embeddings for chunks and adds them to FAISS HNSW."""
    langchain_chunks = [
        Document(page_content=c["page_content"], metadata=c["metadata"])
        for c in state.chunks
    ]
    service = get_embedding_service()
    hnsw = get_hnsw_index()

    indices_to_embed, new_hashes = service.identify_changed_chunks(langchain_chunks)

    if indices_to_embed:
        chunks_to_embed = [langchain_chunks[i] for i in indices_to_embed]
        texts = [c.page_content for c in chunks_to_embed]
        embeddings = service.embed_texts(texts)

        hnsw.add_documents(chunks_to_embed, embeddings)
        hnsw.save()

        for chunk, h in zip(chunks_to_embed, new_hashes):
            cid = chunk.metadata.get("chunk_id", "")
            if cid:
                service.update_hash_cache(cid, h)

    return {"embeddings_status": "completed"}


def faiss_indexing_node(state: RAGState) -> Dict[str, Any]:
    """Builds and updates BM25 store and marks documents as indexed in SQLite."""
    db = get_db()
    hnsw = get_hnsw_index()
    bm25 = get_bm25_retriever()

    # Sync BM25 with all FAISS store chunks
    all_chunks = [
        Document(page_content=v["page_content"], metadata=v["metadata"])
        for v in hnsw.doc_store.values()
    ]
    if all_chunks:
        bm25.index_documents(all_chunks)

    indexing_status = dict(state.indexing_status)
    newly_indexed: List[str] = []

    doc_chunk_counts: Dict[str, int] = {}
    for c in state.chunks:
        doc_id = c.get("metadata", {}).get("document_id")
        if doc_id:
            doc_chunk_counts[doc_id] = doc_chunk_counts.get(doc_id, 0) + 1

    for doc_id, count in doc_chunk_counts.items():
        db.mark_document_indexed(doc_id, count)
        indexing_status[doc_id] = True
        newly_indexed.append(doc_id)

    return {
        "indexing_status": indexing_status,
        "newly_indexed_documents": newly_indexed,
        "unindexed_document_ids": []
    }


def hybrid_retrieval_entry_node(state: RAGState) -> Dict[str, Any]:
    """
    Fan-out entry point that transitions either directly from document_availability_check
    (Case 1) or from the completed ingestion pipeline (Cases 2 & 3) into parallel hybrid search.
    """
    return {}


# ----------------------------------------------------
# 5. Hybrid Retrieval & Reranking Nodes
# ----------------------------------------------------

def vector_retrieval_node(state: RAGState) -> Dict[str, Any]:
    """Executes dense vector search using FAISS IndexHNSWFlat across active queries."""
    settings = get_settings()
    store = get_vector_store()
    search_queries = state.rewritten_queries or [state.original_query]
    seen_chunk_ids = set(r.get("metadata", {}).get("chunk_id", "") for r in state.vector_results)
    all_vector_results: List[Dict[str, Any]] = list(state.vector_results)

    for q in search_queries[:3]:
        scored_docs = store.similarity_search_with_score(q, k=settings.VECTOR_TOP_K)
        for doc, score in scored_docs:
            cid = doc.metadata.get("chunk_id", "")
            if cid and cid not in seen_chunk_ids:
                seen_chunk_ids.add(cid)
                all_vector_results.append({
                    "page_content": doc.page_content,
                    "metadata": doc.metadata,
                    "score": float(score)
                })

    return {"vector_results": all_vector_results}


def bm25_retrieval_node(state: RAGState) -> Dict[str, Any]:
    """Executes sparse keyword retrieval using BM25 across active queries."""
    settings = get_settings()
    bm25 = get_bm25_retriever()
    search_queries = state.rewritten_queries or [state.original_query]
    seen_chunk_ids = set(r.get("metadata", {}).get("chunk_id", "") for r in state.bm25_results)
    all_bm25_results: List[Dict[str, Any]] = list(state.bm25_results)

    for q in search_queries[:3]:
        scored_docs = bm25.search_with_score(q, top_k=settings.BM25_TOP_K)
        for doc, score in scored_docs:
            cid = doc.metadata.get("chunk_id", "")
            if cid and cid not in seen_chunk_ids:
                seen_chunk_ids.add(cid)
                all_bm25_results.append({
                    "page_content": doc.page_content,
                    "metadata": doc.metadata,
                    "score": float(score)
                })

    return {"bm25_results": all_bm25_results}


def reciprocal_rank_fusion_node(state: RAGState) -> Dict[str, Any]:
    """Merges dense and sparse retrieval rankings using Reciprocal Rank Fusion."""
    settings = get_settings()
    dense_tuples = [
        (Document(page_content=r["page_content"], metadata=r["metadata"]), r["score"])
        for r in state.vector_results
    ]
    bm25_tuples = [
        (Document(page_content=r["page_content"], metadata=r["metadata"]), r["score"])
        for r in state.bm25_results
    ]

    fused = reciprocal_rank_fusion(dense_tuples, bm25_tuples, k=settings.RRF_K)
    return {
        "fused_results": fused,
        "retrieved_documents": fused
    }


def reranking_node(state: RAGState) -> Dict[str, Any]:
    """Applies Cross-Encoder reranking on top RRF candidate chunks with cross-lingual support."""
    settings = get_settings()
    reranker = get_reranker()
    reranked = reranker.rerank(
        query=state.original_query,
        candidates=state.fused_results,
        translated_query=state.translated_query,
        input_top_k=settings.RERANK_INPUT_TOP_K,
        final_top_k=settings.FINAL_TOP_K
    )
    return {"reranked_documents": reranked}


# ----------------------------------------------------
# 6. Evaluation, Verification & Knowledge Refinement Nodes
# ----------------------------------------------------

def retrieval_evaluation_node(state: RAGState) -> Dict[str, Any]:
    """
    Critically evaluates context relevance and topic coverage using LLM.
    Fast-paths high-confidence retrieval matches using deterministic heuristic evaluation (< 1ms).
    """
    settings = get_settings()
    eval_agent = get_eval_agent()

    # Latency optimization: If top retrieved document has high confidence, use heuristic evaluation
    if state.reranked_documents:
        top_doc = state.reranked_documents[0]
        rerank_prob = top_doc.get("rerank_probability", 0.0)
        rrf_score = top_doc.get("score", 0.0)
        if rerank_prob >= 0.70 or rrf_score >= 0.015:
            eval_res = eval_agent._heuristic_evaluate(
                query=state.original_query,
                retrieved_documents=state.reranked_documents,
                threshold=settings.EVALUATION_THRESHOLD
            )
            dumped = eval_res.model_dump()
            return {
                "retrieval_evaluation": dumped,
                "evaluation_result": dumped
            }

    eval_res = eval_agent.evaluate(
        query=state.original_query,
        retrieved_documents=state.reranked_documents,
        threshold=settings.EVALUATION_THRESHOLD
    )
    dumped = eval_res.model_dump()
    return {
        "retrieval_evaluation": dumped,
        "evaluation_result": dumped
    }


def source_verification_node(state: RAGState) -> Dict[str, Any]:
    """
    Verifies source authenticity, domain legitimacy, issuing authority, and document age.
    Assigns reliability scores and flags outdated documents.
    """
    agent = get_verification_agent()
    verified_docs = agent.verify_documents(state.reranked_documents)
    verification_summaries = [d["source_verification"] for d in verified_docs if "source_verification" in d]

    return {
        "reranked_documents": verified_docs,
        "source_verification_results": verification_summaries
    }


def knowledge_refinement_node(state: RAGState) -> Dict[str, Any]:
    """
    Identifies missing information aspects and generates targeted gap-filling queries.
    Limits refinement loops to 2 iterations.
    """
    agent = get_refinement_agent()
    eval_data = state.retrieval_evaluation or state.answerability_result or {}

    analysis = agent.analyze_and_refine(
        query=state.original_query,
        retrieved_documents=state.reranked_documents,
        current_attempt=state.refinement_attempts,
        eval_result=eval_data
    )

    new_attempt = state.refinement_attempts + 1

    return {
        "knowledge_refinement_queries": analysis.targeted_queries,
        "refinement_attempts": new_attempt
    }


def contextual_compression_node(state: RAGState) -> Dict[str, Any]:
    """
    Extracts relevant factual paragraphs while strictly preserving figures, dates,
    eligibility criteria, and source metadata.
    """
    compressor = get_compressor()
    compressed = compressor.compress_documents(
        documents=state.reranked_documents,
        query=state.original_query,
        max_chunks=5
    )
    return {"compressed_context": compressed}


def document_language_detection_node(state: RAGState) -> Dict[str, Any]:
    """
    Detects the languages of retrieved documents or chunks, identifies multilingual
    document sets, and updates state with document language metadata.
    """
    service = get_context_understanding_service()
    chunks = state.compressed_context or state.reranked_documents
    doc_langs = service.detect_document_languages(chunks)
    primary_lang = doc_langs[0] if doc_langs else "English"
    return {
        "document_languages": doc_langs,
        "context_language": primary_lang
    }


def context_understanding_node(state: RAGState) -> Dict[str, Any]:
    """
    Cross-lingual understanding and alignment node:
    - Preserves original context verbatim without loss of meaning.
    - Aligns factual entities (scheme names, amounts, dates, departments).
    - Detects contradictions across sources.
    - Generates alignment guidance for target response language.
    """
    service = get_context_understanding_service()
    chunks = state.compressed_context or state.reranked_documents
    target_resp_lang = state.response_language or state.detected_language or "English"

    understanding = service.align_context(
        chunks=chunks,
        user_language=state.detected_language,
        response_language=target_resp_lang
    )

    return {
        "original_context": understanding.original_context,
        "translated_context": understanding.translated_context,
        "context_language": understanding.context_language,
        "answer_language": target_resp_lang,
        "document_languages": understanding.document_languages
    }


def answerability_evaluation_node(state: RAGState) -> Dict[str, Any]:
    """
    Evaluates whether the retrieved and compressed context contains sufficient facts
    to completely answer the specific user question (distinct from document relevance).
    Fast-paths when retrieval evaluation already verified sufficiency to save 5s latency.
    """
    ret_eval = state.retrieval_evaluation or {}
    if ret_eval.get("is_relevant", False) and ret_eval.get("sufficient_context", False):
        return {
            "answerability_result": {
                "is_answerable": True,
                "answerability_score": 0.95,
                "confidence": 0.95,
                "reason": "Context sufficiency confirmed during retrieval evaluation."
            }
        }

    evaluator = get_answerability_eval()
    docs = state.compressed_context or state.reranked_documents
    eval_target = state.translated_query or state.normalized_query or state.original_query
    res = evaluator.evaluate(query=eval_target, context_documents=docs)
    return {"answerability_result": res.model_dump()}


# ----------------------------------------------------
# 7. Generation, Faithfulness & Citation Validation Nodes
# ----------------------------------------------------

def answer_generation_node(state: RAGState) -> Dict[str, Any]:
    """
    Synthesizes factual answer strictly grounded in verified context.
    Incorporates feedback from previous faithfulness evaluations if regenerating.
    Generates in response_language while strictly preserving scheme names, amounts, and dates.
    """
    answer_gen = get_answer_gen()
    docs = state.compressed_context or state.reranked_documents
    target_resp_lang = state.response_language or state.detected_language or "English"

    # Context understanding guidance
    service = get_context_understanding_service()
    understanding = service.align_context(
        chunks=docs,
        user_language=state.detected_language,
        response_language=target_resp_lang
    )

    response = answer_gen.generate(
        query=state.original_query,
        retrieved_documents=docs,
        evaluator_feedback=state.evaluator_feedback,
        response_language=target_resp_lang,
        alignment_guidance=understanding.alignment_guidance
    )
    new_attempts = state.generation_attempts + 1
    return {
        "final_answer": response.answer,
        "citations": [c.model_dump() for c in response.sources],
        "generation_attempts": new_attempts,
        "answer_language": target_resp_lang
    }


def faithfulness_evaluation_node(state: RAGState) -> Dict[str, Any]:
    """
    Evaluates whether every claim in the generated answer is supported by the context.
    Flags hallucinations, unsupported figures, and generates feedback for regeneration.
    Fast-paths deterministic numerical and fact verification (< 1ms) to save 14s latency.
    """
    evaluator = get_faithfulness_eval()
    docs = state.compressed_context or state.reranked_documents

    # Latency optimization: Use deterministic heuristic numerical validation
    f_res = evaluator._heuristic_evaluate(answer=state.final_answer, context_documents=docs)

    feedback = None
    if not f_res.is_faithful and f_res.unsupported_claims:
        feedback = f"Please remove or correct these ungrounded claims: {'; '.join(f_res.unsupported_claims)}. Reason: {f_res.reason}"

    return {
        "faithfulness_result": f_res.model_dump(),
        "evaluator_feedback": feedback
    }


def citation_validation_node(state: RAGState) -> Dict[str, Any]:
    """
    Validates all cited URLs against context metadata and SQLite records.
    Filters out fabricated links and ensures genuine provenance metadata.
    """
    validator = get_citation_validator()
    docs = state.compressed_context or state.reranked_documents
    validation_res = validator.validate_citations(
        citations=state.citations,
        context_documents=docs
    )
    validated_citations = [s.model_dump() for s in validation_res.verified_sources]
    return {
        "citation_validation_result": validation_res.model_dump(),
        "citations": validated_citations
    }


def controlled_fallback_node(state: RAGState) -> Dict[str, Any]:
    """Generates the required controlled refusal response in user's language when info is unavailable."""
    answer_gen = get_answer_gen()
    lang = state.response_language or state.detected_language or "English"
    fallback_text = answer_gen.get_controlled_refusal(lang)
    return {
        "final_answer": fallback_text,
        "answer_language": lang,
        "citations": []
    }


def final_response_node(state: RAGState) -> Dict[str, Any]:
    """
    Formats the final consolidated output with multilingual provenance.
    Applies output guardrails to ensure domain whitelisting and strip unsafe links.
    """
    raw_answer = state.final_answer or ""
    # Enforce output guardrail if not already a blocked message
    if not state.is_blocked and raw_answer:
        cleaned_answer = GovernmentRAGGuardrails.enforce_output_guardrail(raw_answer)
    else:
        cleaned_answer = raw_answer

    return {
        "final_answer": cleaned_answer,
        "citations": state.citations,
        "detected_language": state.detected_language,
        "language_code": state.language_code,
        "detected_script": state.detected_script,
        "response_language": state.response_language,
        "answer_language": state.answer_language or state.response_language,
        "guardrail_result": state.guardrail_result,
        "is_blocked": state.is_blocked
    }


def source_discovery_node(state: RAGState) -> Dict[str, Any]:
    """Identifies whether necessary government documents already exist or need discovery (ingestion graph)."""
    db = get_db()
    total_docs = db.count_documents()
    need_scrape = total_docs == 0 or state.is_ingestion_needed
    return {
        "is_ingestion_needed": need_scrape,
        "search_results": [{"status": "existing_indexed", "count": total_docs}]
    }
