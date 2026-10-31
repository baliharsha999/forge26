"""
Conditional routing edges for Advanced Government Information LangGraph.
Implements:
1. Document availability routing: already indexed -> hybrid_retrieval_entry | in DB unindexed -> html_retrieval | missing -> web_search
2. Post-retrieval routing: relevant -> source_verification | irrelevant -> knowledge_refinement
3. Post-refinement routing: attempts remain -> query_rewriting | maxed out -> controlled_fallback
4. Post-answerability routing: answerable -> answer_generation | unanswerable -> knowledge_refinement / fallback
5. Post-faithfulness routing: faithful -> citation_validation | unfaithful -> regeneration / fallback
"""

from app.graph.state import RAGState
from app.config.settings import get_settings


def route_after_document_availability_check(state: RAGState) -> str:
    """
    Evaluates document availability and determines whether to proceed directly
    to hybrid retrieval, ingest from local HTML, or trigger web scraping.

    - CASE 1: Documents exist in DB and are indexed in FAISS:
        Directly proceed to 'hybrid_retrieval_entry'
    - CASE 2: Documents exist in DB but are not indexed in FAISS:
        Proceed to 'html_retrieval' (no scraping)
    - CASE 3: Documents do not exist in DB:
        Proceed to 'web_search' (conditional scraping)
    """
    if state.scraping_required or bool(state.missing_documents):
        return "web_search"
    if bool(state.unindexed_document_ids):
        return "html_retrieval"
    if bool(state.existing_documents) or bool(state.indexed_document_ids):
        return "hybrid_retrieval_entry"
    return "web_search"


def route_after_retrieval_evaluation(state: RAGState) -> str:
    """
    Evaluates whether retrieval evaluation approved the context relevance.
    Routes to:
      - 'source_verification' if relevant and score >= threshold.
      - 'knowledge_refinement' if irrelevant or topic coverage is insufficient.
    """
    settings = get_settings()
    threshold = settings.EVALUATION_THRESHOLD

    eval_result = state.retrieval_evaluation or {}
    is_relevant = eval_result.get("is_relevant", False)
    score = eval_result.get("relevance_score", 0.0)

    if is_relevant and score >= threshold:
        return "source_verification"
    return "knowledge_refinement"


def route_after_knowledge_refinement(state: RAGState) -> str:
    """
    Determines whether another retrieval iteration should occur.
    Routes to:
      - 'query_rewriting' if refinement attempts < 2 and targeted queries were generated.
      - 'controlled_fallback' if refinement attempts are exhausted.
    """
    # Max refinement attempts allowed: 2
    if state.refinement_attempts < 2 and bool(state.knowledge_refinement_queries):
        return "query_rewriting"
    return "controlled_fallback"


def route_after_answerability(state: RAGState) -> str:
    """
    Evaluates question answerability from the verified, compressed context.
    Routes to:
      - 'answer_generation' if answerable.
      - 'knowledge_refinement' if not answerable and refinement attempts < 2.
      - 'controlled_fallback' if not answerable and refinement exhausted.
    """
    ans_result = state.answerability_result or {}
    is_answerable = ans_result.get("is_answerable", False)
    score = ans_result.get("answerability_score", 0.0)

    if is_answerable and score >= 0.70:
        return "answer_generation"

    if state.refinement_attempts < 2:
        return "knowledge_refinement"
    return "controlled_fallback"


def route_after_faithfulness(state: RAGState) -> str:
    """
    Checks factual grounding of the generated answer.
    Routes to:
      - 'citation_validation' if answer is faithful.
      - 'answer_generation' if unfaithful and generation attempts < 2 (regeneration with feedback).
      - 'controlled_fallback' if unfaithful and regeneration attempts exhausted.
    """
    f_result = state.faithfulness_result or {}
    is_faithful = f_result.get("is_faithful", False)

    if is_faithful:
        return "citation_validation"

    if state.generation_attempts < 2:
        return "answer_generation"

    return "controlled_fallback"


def route_after_source_discovery(state: RAGState) -> str:
    """Routes ingestion discovery."""
    if state.is_ingestion_needed:
        return "web_scraping"
    return "database_storage"
