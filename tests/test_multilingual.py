"""
Comprehensive Test Suite for Multilingual Government Information RAG System.
Covers 8 Key Evaluation Scenarios:
1. Hindi query, English document -> Hindi answer.
2. Telugu query, English document -> Telugu answer.
3. English query, Hindi document -> English answer.
4. Romanized Hindi query ("mujhe students ke liye govt scholarship batao").
5. Mixed English and Telugu query (Code-switching).
6. Government scheme name preservation across translation.
7. Multilingual documents with conflicting dates / figures.
8. No relevant document available -> Controlled refusal in user's language.
"""

import sys
import os
sys.path.insert(0, os.path.abspath("."))

import pytest
from typing import Dict, Any
from langchain_core.documents import Document

from app.graph.state import RAGState
from app.agents.language_agent import LanguageAgent
from app.agents.normalization_agent import QueryNormalizationAgent
from app.agents.multilingual_query_agent import MultilingualQueryAgent
from app.retrieval.context_understanding import ContextUnderstandingService
from app.retrieval.bm25_retriever import language_aware_tokenizer, GovernmentBM25Retriever
from app.retrieval.hnsw_index import FAISSHNSWIndex
from app.retrieval.reranker import GovernmentReranker
from app.generation.answer_generator import AnswerGenerator
from app.graph.nodes import (
    language_detection_node,
    query_normalization_node,
    multilingual_query_expansion_node,
    query_translation_node,
    document_language_detection_node,
    context_understanding_node,
    controlled_fallback_node,
    answer_generation_node,
)
from app.graph.workflow import build_query_retrieval_graph


# ==============================================================================
# SCENARIO 1: Hindi query, English document -> Hindi answer
# ==============================================================================

def test_scenario_1_hindi_query_english_doc_to_hindi_answer():
    """Verify Hindi query detects Devanagari script, translates to English for retrieval, and answers in Hindi."""
    hindi_query = "पीएम किसान योजना के तहत किसानों को कितनी वित्तीय सहायता मिलती है?"
    state = RAGState(original_query=hindi_query)

    # 1. Language detection
    det_res = language_detection_node(state)
    assert det_res["detected_language"] == "Hindi"
    assert det_res["language_code"] == "hi"
    assert det_res["detected_script"] == "Devanagari"
    assert det_res["response_language"] == "Hindi"
    state = state.model_copy(update=det_res)

    # 2. Query Translation
    trans_res = query_translation_node(state)
    assert trans_res["translation_status"] == "translated"
    assert "kisan" in trans_res["translated_query"].lower()
    state = state.model_copy(update=trans_res)

    # 3. Context Understanding with English chunk
    english_chunk = {
        "page_content": "Under PM-KISAN, eligible farmers receive financial benefit of Rs. 6,000 per year in three equal installments of Rs. 2,000 every four months.",
        "metadata": {
            "title": "Pradhan Mantri Kisan Samman Nidhi",
            "department": "Department of Agriculture",
            "source_url": "https://pmkisan.gov.in"
        }
    }
    state = state.model_copy(update={"compressed_context": [english_chunk]})
    ctx_res = context_understanding_node(state)
    assert ctx_res["answer_language"] == "Hindi"
    assert ctx_res["context_language"] == "English"

    # 4. Answer Generation in Hindi
    gen = AnswerGenerator()
    resp = gen.generate(
        query=hindi_query,
        retrieved_documents=[english_chunk],
        response_language="Hindi"
    )
    assert resp.answer is not None
    # Verify that numbers and key facts are preserved
    assert "6,000" in resp.answer or "6000" in resp.answer
    assert "PM-KISAN" in resp.answer or "पीएम-किसान" in resp.answer or "किसान" in resp.answer
    assert len(resp.sources) > 0


# ==============================================================================
# SCENARIO 2: Telugu query, English document -> Telugu answer
# ==============================================================================

def test_scenario_2_telugu_query_english_doc_to_telugu_answer():
    """Verify Telugu query detects Telugu script and responds in Telugu preserving key scheme details."""
    telugu_query = "రైతులకు ప్రభుత్వం ఇచ్చే సబ్సిడీలు ఏమిటి?"
    state = RAGState(original_query=telugu_query)

    det_res = language_detection_node(state)
    assert det_res["detected_language"] == "Telugu"
    assert det_res["language_code"] == "te"
    assert det_res["detected_script"] == "Telugu"
    assert det_res["response_language"] == "Telugu"

    english_chunk = {
        "page_content": "The government provides agricultural subsidies including PM-KISAN financial support of Rs. 6,000 annually and fertilizer subsidies.",
        "metadata": {
            "title": "Agricultural Welfare Schemes",
            "department": "Ministry of Agriculture",
            "source_url": "https://agricoop.nic.in"
        }
    }
    gen = AnswerGenerator()
    resp = gen.generate(
        query=telugu_query,
        retrieved_documents=[english_chunk],
        response_language="Telugu"
    )
    assert resp.answer is not None
    assert "6,000" in resp.answer or "6000" in resp.answer
    assert len(resp.sources) > 0


# ==============================================================================
# SCENARIO 3: English query, Hindi document -> English answer
# ==============================================================================

def test_scenario_3_english_query_hindi_doc_to_english_answer():
    """Verify English query with Hindi source document outputs faithful English response."""
    english_query = "What financial assistance is provided under the rural employment scheme?"
    state = RAGState(original_query=english_query)

    det_res = language_detection_node(state)
    assert det_res["detected_language"] == "English"
    assert det_res["response_language"] == "English"

    hindi_chunk = {
        "page_content": "महात्मा गांधी राष्ट्रीय ग्रामीण रोजगार गारंटी योजना के अंतर्गत प्रत्येक ग्रामीण परिवार को वित्तीय वर्ष में 100 दिनों का अकुशल मजदूरी रोजगार दिया जाता है।",
        "metadata": {
            "title": "MGNREGA Scheme",
            "department": "Ministry of Rural Development",
            "source_url": "https://nrega.nic.in"
        }
    }

    # Document language detection should detect Hindi
    service = ContextUnderstandingService.get_instance()
    doc_langs = service.detect_document_languages([hindi_chunk])
    assert "Hindi" in doc_langs

    gen = AnswerGenerator()
    resp = gen.generate(
        query=english_query,
        retrieved_documents=[hindi_chunk],
        response_language="English"
    )
    assert resp.answer is not None
    assert "100" in resp.answer or "employment" in resp.answer.lower()
    assert len(resp.sources) > 0


# ==============================================================================
# SCENARIO 4: Romanized Hindi query ("mujhe students ke liye govt scholarship batao")
# ==============================================================================

def test_scenario_4_romanized_hindi_query():
    """Verify Romanized Hindi query is normalized to Devanagari and translated cleanly."""
    query = "mujhe students ke liye govt scholarship batao"
    state = RAGState(original_query=query)

    # 1. Language detection detects Hindi with Latin/Romanized script
    det_res = language_detection_node(state)
    assert det_res["detected_language"] == "Hindi"
    assert det_res["detected_script"] in ("Latin", "Romanized")
    assert det_res["response_language"] == "Hindi"
    state = state.model_copy(update=det_res)

    # 2. Normalization produces clean Devanagari Hindi
    norm_res = query_normalization_node(state)
    assert norm_res["normalized_query"] is not None
    assert any(c >= '\u0900' and c <= '\u097F' for c in norm_res["normalized_query"])
    state = state.model_copy(update=norm_res)

    # 3. Translation to English produces scholarship search query
    trans_res = query_translation_node(state)
    assert "scholarship" in trans_res["translated_query"].lower() or "student" in trans_res["translated_query"].lower()


# ==============================================================================
# SCENARIO 5: Mixed English and Telugu query (Code-switching)
# ==============================================================================

def test_scenario_5_mixed_english_and_telugu_query():
    """Verify code-mixed query is detected as mixed language and resolves cleanly."""
    query = "PM-KISAN scheme lo eligibility criteria emiti?"
    state = RAGState(original_query=query)

    det_res = language_detection_node(state)
    assert det_res["is_mixed_language"] is True
    assert det_res["detected_language"] in ("Telugu", "English")

    norm_agent = QueryNormalizationAgent()
    norm = norm_agent.normalize(query, det_res["detected_language"], det_res["detected_script"])
    assert "PM-KISAN" in norm.normalized_query


# ==============================================================================
# SCENARIO 6: Government Scheme Name Preservation Across Translation
# ==============================================================================

def test_scenario_6_scheme_name_preservation():
    """Verify official scheme names and acronyms are preserved verbatim across translation."""
    query = "प्रधानमंत्री फसल बीमा योजना (PMFBY) के लिए आवेदन कैसे करें?"
    agent = MultilingualQueryAgent()
    trans = agent.translate_to_english(query, source_language="Hindi")

    # The translation must retain PMFBY or Pradhan Mantri Fasal Bima Yojana
    assert "PMFBY" in trans.translated_query or "Pradhan Mantri Fasal Bima Yojana" in trans.translated_query
    assert trans.translation_status == "translated"


# ==============================================================================
# SCENARIO 7: Multilingual Documents Containing Conflicting Dates
# ==============================================================================

def test_scenario_7_multilingual_conflicting_dates():
    """Verify cross-lingual context understanding detects contradictory dates between sources."""
    chunk1 = {
        "page_content": "The initial launch date for the rural development initiative was established in 2018.",
        "metadata": {
            "document_id": "doc_2018",
            "source_url": "https://rural.gov.in/policy2018"
        }
    }
    chunk2 = {
        "page_content": "नई अधिसूचना के अनुसार ग्रामीण विकास परियोजना का आधिकारिक शुभारंभ 2024 में किया गया।",
        "metadata": {
            "document_id": "doc_2024",
            "source_url": "https://rural.gov.in/policy2024"
        }
    }

    service = ContextUnderstandingService.get_instance()
    understanding = service.align_context(
        chunks=[chunk1, chunk2],
        user_language="English",
        response_language="English"
    )

    assert len(understanding.conflicts) > 0
    assert "doc_2018" in understanding.conflicts[0].conflicting_sources
    assert "doc_2024" in understanding.conflicts[0].conflicting_sources


# ==============================================================================
# SCENARIO 8: No Relevant Document Available -> Controlled Refusal in User's Language
# ==============================================================================

def test_scenario_8_no_relevant_document_controlled_refusal_telugu():
    """Verify controlled refusal is generated in Telugu when user queried in Telugu."""
    state = RAGState(
        original_query="అంతరిక్షంలో వ్యవసాయం చేయడానికి ప్రభుత్వ పథకం ఉందా?",
        detected_language="Telugu",
        response_language="Telugu"
    )
    fallback_res = controlled_fallback_node(state)
    refusal_answer = fallback_res["final_answer"]

    # Must be in Telugu and contain official refusal phrasing
    assert "సమాచారం లేదు" in refusal_answer
    assert fallback_res["answer_language"] == "Telugu"


def test_scenario_8_no_relevant_document_controlled_refusal_hindi():
    """Verify controlled refusal is generated in Hindi when user queried in Hindi."""
    state = RAGState(
        original_query="मंगल ग्रह पर खेती के लिए सरकारी योजना बताएं",
        detected_language="Hindi",
        response_language="Hindi"
    )
    fallback_res = controlled_fallback_node(state)
    refusal_answer = fallback_res["final_answer"]

    # Must be in Hindi
    assert "सत्यापित जानकारी" in refusal_answer
    assert fallback_res["answer_language"] == "Hindi"


# ==============================================================================
# TOKENIZER AND RETRIEVER UNIT CHECKS
# ==============================================================================

def test_language_aware_tokenizer_indic_and_schemes():
    """Verify tokenizer preserves Indic vowel signs, numbers, and scheme compounds."""
    text = "రైతులకు 6000 రూపాయలు PM-KISAN pm_kisan! किसानों के लिए 6000 रुपये।"
    tokens = language_aware_tokenizer(text)
    assert "రైతులకు" in tokens
    assert "6000" in tokens
    assert "pm-kisan" in tokens or "pm" in tokens
    assert "किसानों" in tokens
    assert "रुपये" in tokens
