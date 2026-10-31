"""
LangGraph Workflow Orchestration for Advanced Government Information RAG System.
Features:
- Query Analysis, Decomposition & Multi-Strategy Rewriting
- Database-First Document Availability Checking (DB vs FAISS presence)
- Conditional Web Scraping & Ingestion (only when missing or unindexed)
- Canonical URL Normalization & Content Hash Deduplication
- Parallel Hybrid Retrieval (FAISS IndexHNSWFlat + Sparse BM25)
- Reciprocal Rank Fusion & Cross-Encoder Reranking
- Multi-Stage Evaluation (Retrieval Relevance, Answerability, Faithfulness)
- Source Authenticity Verification & Contextual Compression
- Iterative Knowledge Refinement Loop (max 2 iterations)
- Grounded Answer Generation & Citation Validation
"""

import os
from typing import Optional
from langgraph.graph import StateGraph, START, END

from app.graph.state import RAGState
from app.graph.nodes import (
    input_guardrail_node,
    language_detection_node,
    query_normalization_node,
    multilingual_query_expansion_node,
    query_translation_node,
    query_analysis_node,
    query_decomposition_node,
    query_rewriting_node,
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
    hybrid_retrieval_entry_node,
    vector_retrieval_node,
    bm25_retrieval_node,
    reciprocal_rank_fusion_node,
    reranking_node,
    retrieval_evaluation_node,
    source_verification_node,
    knowledge_refinement_node,
    contextual_compression_node,
    document_language_detection_node,
    context_understanding_node,
    answerability_evaluation_node,
    answer_generation_node,
    faithfulness_evaluation_node,
    citation_validation_node,
    controlled_fallback_node,
    final_response_node,
    source_discovery_node,
)
from app.graph.edges import (
    route_after_input_guardrail,
    route_after_document_availability_check,
    route_after_retrieval_evaluation,
    route_after_knowledge_refinement,
    route_after_answerability,
    route_after_faithfulness,
)


def build_ingestion_graph():
    """
    Constructs the Reusable Document Ingestion Workflow.
    Triggered initially or on-demand when external documents are acquired.
    """
    workflow = StateGraph(RAGState)

    workflow.add_node("source_discovery", source_discovery_node)
    workflow.add_node("web_scraping", web_scraping_node)
    workflow.add_node("html_extraction", html_extraction_node)
    workflow.add_node("database_storage", database_storage_node)
    workflow.add_node("html_retrieval", html_retrieval_node)
    workflow.add_node("document_loading", document_loading_node)
    workflow.add_node("document_chunking", document_chunking_node)
    workflow.add_node("embedding_generation", embedding_generation_node)
    workflow.add_node("faiss_indexing", faiss_indexing_node)

    workflow.add_edge(START, "source_discovery")
    workflow.add_edge("source_discovery", "web_scraping")
    workflow.add_edge("web_scraping", "html_extraction")
    workflow.add_edge("html_extraction", "database_storage")
    workflow.add_edge("database_storage", "html_retrieval")
    workflow.add_edge("html_retrieval", "document_loading")
    workflow.add_edge("document_loading", "document_chunking")
    workflow.add_edge("document_chunking", "embedding_generation")
    workflow.add_edge("embedding_generation", "faiss_indexing")
    workflow.add_edge("faiss_indexing", END)

    return workflow.compile()


def build_query_retrieval_graph():
    """
    Constructs the Database-First Query-Time Retrieval & Ingestion Workflow.
    Architecture:
      START -> query_analysis -> query_decomposition -> query_rewriting
      -> document_availability_check
      -> (Conditional:
            CASE 1 (Already in DB & FAISS): hybrid_retrieval_entry
            CASE 2 (In DB but Not Indexed): html_retrieval -> document_loading -> chunking -> embedding -> indexing -> hybrid_retrieval_entry
            CASE 3 (Not in DB): web_search -> url_validation -> web_scraping -> html_extraction -> db_storage -> loading -> chunking -> embedding -> indexing -> hybrid_retrieval_entry
         )
      -> [Parallel: vector_retrieval || bm25_retrieval] -> reciprocal_rank_fusion
      -> reranking -> retrieval_evaluation
      -> (Conditional: relevant -> source_verification | irrelevant -> knowledge_refinement)
      -> source_verification -> contextual_compression -> answerability_evaluation
      -> (Conditional: answerable -> answer_generation | unanswerable -> knowledge_refinement / fallback)
      -> knowledge_refinement -> (Conditional: refine attempts remain -> query_rewriting | exhausted -> fallback)
      -> answer_generation -> faithfulness_evaluation
      -> (Conditional: faithful -> citation_validation | unfaithful -> answer_generation / fallback)
      -> citation_validation -> final_response -> END
      -> controlled_fallback -> final_response -> END
    """
    workflow = StateGraph(RAGState)

    # 00. Security guardrail node
    workflow.add_node("input_guardrail", input_guardrail_node)

    # 0. Multilingual understanding & translation nodes
    workflow.add_node("language_detection", language_detection_node)
    workflow.add_node("query_normalization", query_normalization_node)
    workflow.add_node("multilingual_query_expansion", multilingual_query_expansion_node)
    workflow.add_node("query_translation", query_translation_node)

    # 1. Query understanding & rewriting nodes
    workflow.add_node("query_analysis", query_analysis_node)
    workflow.add_node("query_decomposition", query_decomposition_node)
    workflow.add_node("query_rewriting", query_rewriting_node)

    # 2. Document availability checking node
    workflow.add_node("document_availability_check", document_availability_check_node)

    # 3. Conditional Ingestion & Scraping nodes
    workflow.add_node("web_search", web_search_node)
    workflow.add_node("url_validation", url_validation_node)
    workflow.add_node("web_scraping", web_scraping_node)
    workflow.add_node("html_extraction", html_extraction_node)
    workflow.add_node("database_storage", database_storage_node)
    workflow.add_node("html_retrieval", html_retrieval_node)
    workflow.add_node("document_loading", document_loading_node)
    workflow.add_node("document_chunking", document_chunking_node)
    workflow.add_node("embedding_generation", embedding_generation_node)
    workflow.add_node("faiss_indexing", faiss_indexing_node)

    # 4. Hybrid retrieval & ranking nodes
    workflow.add_node("hybrid_retrieval_entry", hybrid_retrieval_entry_node)
    workflow.add_node("vector_retrieval", vector_retrieval_node)
    workflow.add_node("bm25_retrieval", bm25_retrieval_node)
    workflow.add_node("reciprocal_rank_fusion", reciprocal_rank_fusion_node)
    workflow.add_node("reranking", reranking_node)

    # 5. Multi-stage evaluations, context alignment & refinement nodes
    workflow.add_node("retrieval_evaluation", retrieval_evaluation_node)
    workflow.add_node("source_verification", source_verification_node)
    workflow.add_node("contextual_compression", contextual_compression_node)
    workflow.add_node("document_language_detection", document_language_detection_node)
    workflow.add_node("context_understanding", context_understanding_node)
    workflow.add_node("answerability_evaluation", answerability_evaluation_node)
    workflow.add_node("knowledge_refinement", knowledge_refinement_node)

    # 6. Generation, verification & fallback nodes
    workflow.add_node("answer_generation", answer_generation_node)
    workflow.add_node("faithfulness_evaluation", faithfulness_evaluation_node)
    workflow.add_node("citation_validation", citation_validation_node)
    workflow.add_node("controlled_fallback", controlled_fallback_node)
    workflow.add_node("final_response", final_response_node)

    # --- Edge Connections ---

    # Security Guardrail Entry
    workflow.add_edge(START, "input_guardrail")
    workflow.add_conditional_edges(
        "input_guardrail",
        route_after_input_guardrail,
        {
            "final_response": "final_response",
            "language_detection": "language_detection"
        }
    )

    # Multilingual Query Flow
    workflow.add_edge("language_detection", "query_normalization")
    workflow.add_edge("query_normalization", "multilingual_query_expansion")
    workflow.add_edge("multilingual_query_expansion", "query_translation")
    workflow.add_edge("query_translation", "query_analysis")
    workflow.add_edge("query_analysis", "query_decomposition")
    workflow.add_edge("query_decomposition", "query_rewriting")
    workflow.add_edge("query_rewriting", "document_availability_check")

    # Conditional 0: Document Availability Routing
    workflow.add_conditional_edges(
        "document_availability_check",
        route_after_document_availability_check,
        {
            "hybrid_retrieval_entry": "hybrid_retrieval_entry",
            "html_retrieval": "html_retrieval",
            "web_search": "web_search",
        }
    )

    # Case 2: In DB but not indexed -> HTML retrieval & indexing pipeline
    workflow.add_edge("html_retrieval", "document_loading")
    workflow.add_edge("document_loading", "document_chunking")
    workflow.add_edge("document_chunking", "embedding_generation")
    workflow.add_edge("embedding_generation", "faiss_indexing")

    # Case 3: Missing from DB -> Web search, scrape, store, and indexing pipeline
    workflow.add_edge("web_search", "url_validation")
    workflow.add_edge("url_validation", "web_scraping")
    workflow.add_edge("web_scraping", "html_extraction")
    workflow.add_edge("html_extraction", "database_storage")
    workflow.add_edge("database_storage", "document_loading")

    # Both ingestion paths converge to hybrid_retrieval_entry
    workflow.add_edge("faiss_indexing", "hybrid_retrieval_entry")

    # Parallel hybrid retrieval fan-out
    workflow.add_edge("hybrid_retrieval_entry", "vector_retrieval")
    workflow.add_edge("hybrid_retrieval_entry", "bm25_retrieval")

    # Fan-in to RRF
    workflow.add_edge("vector_retrieval", "reciprocal_rank_fusion")
    workflow.add_edge("bm25_retrieval", "reciprocal_rank_fusion")

    # Reranking & initial relevance evaluation
    workflow.add_edge("reciprocal_rank_fusion", "reranking")
    workflow.add_edge("reranking", "retrieval_evaluation")

    # Conditional 1: Post-retrieval relevance
    workflow.add_conditional_edges(
        "retrieval_evaluation",
        route_after_retrieval_evaluation,
        {
            "source_verification": "source_verification",
            "knowledge_refinement": "knowledge_refinement"
        }
    )

    # Verification -> Compression -> Document Language Detection -> Context Understanding -> Answerability
    workflow.add_edge("source_verification", "contextual_compression")
    workflow.add_edge("contextual_compression", "document_language_detection")
    workflow.add_edge("document_language_detection", "context_understanding")
    workflow.add_edge("context_understanding", "answerability_evaluation")

    # Conditional 2: Post-answerability evaluation
    workflow.add_conditional_edges(
        "answerability_evaluation",
        route_after_answerability,
        {
            "answer_generation": "answer_generation",
            "knowledge_refinement": "knowledge_refinement",
            "controlled_fallback": "controlled_fallback"
        }
    )

    # Conditional 3: Knowledge refinement loop (routes to query rewriting -> availability check)
    workflow.add_conditional_edges(
        "knowledge_refinement",
        route_after_knowledge_refinement,
        {
            "query_rewriting": "query_rewriting",
            "controlled_fallback": "controlled_fallback"
        }
    )

    # Generation -> Faithfulness Evaluation
    workflow.add_edge("answer_generation", "faithfulness_evaluation")

    # Conditional 4: Faithfulness & regeneration loop
    workflow.add_conditional_edges(
        "faithfulness_evaluation",
        route_after_faithfulness,
        {
            "citation_validation": "citation_validation",
            "answer_generation": "answer_generation",
            "controlled_fallback": "controlled_fallback"
        }
    )

    # Final outputs
    workflow.add_edge("citation_validation", "final_response")
    workflow.add_edge("controlled_fallback", "final_response")
    workflow.add_edge("final_response", END)

    return workflow.compile()


def export_graph_visualizations(output_dir: str = "data"):
    """Renders Mermaid diagram strings and saves them to markdown documentation."""
    os.makedirs(output_dir, exist_ok=True)
    query_app = build_query_retrieval_graph()
    ingest_app = build_ingestion_graph()

    mermaid_doc = (
        "# Advanced Government Information RAG System Architecture (LangGraph)\n\n"
        "## 1. Upgraded Database-First Query-Time Retrieval & Ingestion Workflow\n"
        "```mermaid\n"
        f"{query_app.get_graph().draw_mermaid()}\n"
        "```\n\n"
        "## 2. Reusable Document Ingestion Workflow\n"
        "```mermaid\n"
        f"{ingest_app.get_graph().draw_mermaid()}\n"
        "```\n"
    )

    out_file = os.path.join(output_dir, "graph_architecture.md")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(mermaid_doc)

    print(f"[Workflow] Saved updated LangGraph architecture visualizations to {out_file}")

    # Attempt saving PNG if supported
    try:
        png_data = query_app.get_graph().draw_mermaid_png()
        png_file = os.path.join(output_dir, "query_workflow.png")
        with open(png_file, "wb") as f:
            f.write(png_data)
        print(f"[Workflow] Saved query workflow PNG to {png_file}")
    except Exception as e:
        print(f"[Workflow] Note: PNG export requires graphviz/mermaid rendering service ({e}). Mermaid markdown is saved.")


# Instantiated workflow applications
query_rag_graph = build_query_retrieval_graph()
ingestion_graph = build_ingestion_graph()
