"""
Unit tests for Advanced RAG components:
1. Query decomposition
2. Improved query rewriting
3. Source verification
4. Knowledge refinement
5. Contextual compression
6. Answerability evaluation
7. Faithfulness evaluation
8. Citation validation
9. Conditional routing
"""

import pytest
from app.agents.decomposition_agent import QueryDecompositionAgent
from app.agents.query_agent import QueryAnalysisAgent
from app.agents.verification_agent import SourceVerificationAgent
from app.agents.refinement_agent import KnowledgeRefinementAgent
from app.retrieval.contextual_compressor import ContextualCompressor
from app.evaluation.answerability_eval import AnswerabilityEvaluator
from app.evaluation.faithfulness_eval import FaithfulnessEvaluator
from app.evaluation.citation_eval import CitationValidator
from app.graph.state import RAGState
from app.graph.edges import (
    route_after_retrieval_evaluation,
    route_after_knowledge_refinement,
    route_after_answerability,
    route_after_faithfulness
)


def test_query_decomposition():
    """Verify that query decomposition produces structured subqueries and requirements."""
    agent = QueryDecompositionAgent()
    query = "What financial benefits can engineering students from economically weaker backgrounds receive from the government?"
    decomp = agent.decompose(query)

    assert len(decomp.subqueries) >= 2, "Should generate multiple subqueries"
    assert len(decomp.information_requirements) >= 1
    assert any("scholarship" in s.lower() or "student" in s.lower() or "financial" in s.lower() for s in decomp.subqueries)
    assert any("education" in d.lower() for d in decomp.target_departments)


def test_improved_query_rewriting():
    """Verify query rewriting produces semantic, keyword, alternative, and department queries."""
    agent = QueryAnalysisAgent()
    query = "What loans are available under MUDRA scheme for micro enterprises?"
    rewriting = agent.rewrite_advanced(
        query=query,
        department="Ministry of Finance",
        decomposed_queries=["MUDRA scheme loan categories", "Eligibility criteria for micro enterprises"],
        missing_aspects=["Interest subsidy"]
    )

    assert len(rewriting.semantic_queries) >= 1
    assert len(rewriting.keyword_queries) >= 1
    assert len(rewriting.alternative_queries) >= 1
    assert len(rewriting.department_queries) >= 1
    assert len(rewriting.missing_info_queries) >= 1
    assert len(rewriting.all_queries) >= 5


def test_source_verification():
    """Verify source verification flags official domains, checks dates, and calculates age."""
    agent = SourceVerificationAgent()

    # 1. Current official document
    doc_current = {
        "metadata": {
            "document_id": "pmmy",
            "title": "Pradhan Mantri Mudra Yojana",
            "source_url": "https://www.myscheme.gov.in/schemes/pmmy",
            "department": "Ministry of Finance",
            "publication_date": "2026-01-15",
            "last_updated": "2026-05-10"
        }
    }
    v_current = agent.verify_single(doc_current)
    assert v_current.is_official_domain is True
    assert v_current.is_outdated is False
    assert v_current.reliability_score >= 0.85
    assert v_current.status == "VERIFIED_OFFICIAL_CURRENT"

    # 2. Outdated official document (2015)
    doc_outdated = {
        "metadata": {
            "document_id": "old_policy",
            "title": "Old MSME Policy 2015",
            "source_url": "https://msme.gov.in/old-policy-2015",
            "department": "Ministry of MSME",
            "publication_date": "2015-04-01",
            "last_updated": "2015-04-01"
        }
    }
    v_outdated = agent.verify_single(doc_outdated)
    assert v_outdated.is_official_domain is True
    assert v_outdated.is_outdated is True
    assert v_outdated.status == "VERIFIED_OFFICIAL_OUTDATED"

    # 3. Third-party unverified blog
    doc_third_party = {
        "metadata": {
            "document_id": "blog123",
            "title": "Free Money Blog",
            "source_url": "https://randomfinanceblog.com/schemes",
            "department": "Unknown",
            "publication_date": "2026-01-01"
        }
    }
    v_third = agent.verify_single(doc_third_party)
    assert v_third.is_official_domain is False
    assert v_third.reliability_score < 0.60


def test_knowledge_refinement():
    """Verify that knowledge refinement detects missing aspects and limits iterations."""
    agent = KnowledgeRefinementAgent()
    query = "What are the eligibility criteria, benefits and application process for PMMY?"
    retrieved = [
        {"page_content": "Pradhan Mantri Mudra Yojana provides Shishu, Kishore, and Tarun loans up to Rs. 10 Lakhs with interest subsidies."}
    ]

    analysis = agent.analyze_and_refine(query=query, retrieved_documents=retrieved, current_attempt=0)
    assert analysis.should_continue_refinement is True
    assert len(analysis.targeted_queries) >= 1
    # Check that query targets missing aspects
    assert any("eligib" in q.lower() or "criteria" in q.lower() or "apply" in q.lower() for q in analysis.targeted_queries)

    # Test loop termination when attempt >= 2
    max_analysis = agent.analyze_and_refine(query=query, retrieved_documents=retrieved, current_attempt=2)
    assert max_analysis.should_continue_refinement is False
    assert len(max_analysis.targeted_queries) == 0


def test_contextual_compression():
    """Verify contextual compression extracts relevant paragraphs while preserving numbers and dates."""
    compressor = ContextualCompressor()
    query = "What is the subsidy amount under PM Surya Ghar?"
    chunk = {
        "page_content": (
            "Navigation header: Home > Schemes > Energy.\n"
            "PM Surya Ghar Muft Bijli Yojana provides subsidies up to ₹78,000 for 3kW rooftop solar installations.\n"
            "Households receive up to 300 units of free electricity per month.\n"
            "Advertisement: Check out best batteries for homes.\n"
            "Eligibility criteria: Must be an Indian citizen with suitable roof space and active grid connection."
        ),
        "metadata": {"title": "PM Surya Ghar", "source_url": "https://pmsuryaghar.gov.in"}
    }

    compressed = compressor.compress_chunk(chunk, query)
    c_text = compressed["page_content"]
    assert "₹78,000" in c_text
    assert "300 units" in c_text
    assert "Indian citizen" in c_text
    assert compressed["compression_ratio"] <= 1.0


def test_answerability_evaluation():
    """Verify answerability evaluation separates document relevance from question completeness."""
    evaluator = AnswerabilityEvaluator()

    # Case A: Complete context
    query = "What is the loan limit under Tarun category of PMMY?"
    context_complete = [{
        "page_content": "Under PMMY, Tarun covers loans above Rs. 5 Lakhs and up to Rs. 10 Lakhs for established enterprises."
    }]
    res_a = evaluator.evaluate(query, context_complete)
    assert res_a.is_answerable is True
    assert res_a.answerability_score >= 0.70

    # Case B: Incomplete context (relevant scheme, but missing requested information)
    query_b = "What is the exact minimum CIBIL score required for PMMY?"
    context_incomplete = [{
        "page_content": "PMMY offers Shishu loans up to 50,000, Kishore up to 5 Lakhs, and Tarun up to 10 Lakhs. It provides collateral-free credit."
    }]
    res_b = evaluator.evaluate(query_b, context_incomplete)
    assert res_b.is_answerable is False or len(res_b.missing_aspects) > 0


def test_faithfulness_evaluation():
    """Verify faithfulness evaluation flags unsupported numerical figures and claims."""
    evaluator = FaithfulnessEvaluator()
    context = [{
        "page_content": "PM-KISAN provides Rs. 6,000 per year in three equal installments of Rs. 2,000 each to eligible farmer families."
    }]

    # Case 1: Faithful answer
    ans_faithful = "Under PM-KISAN, eligible farmers receive Rs. 6,000 annually paid in three installments of Rs. 2,000."
    res_f = evaluator.evaluate(ans_faithful, context)
    assert res_f.is_faithful is True
    assert res_f.faithfulness_score >= 0.80

    # Case 2: Hallucinated / inflated numbers
    ans_hallucinated = "Under PM-KISAN, farmers receive Rs. 50,000 every month along with a free tractor."
    res_h = evaluator.evaluate(ans_hallucinated, context)
    assert res_h.is_faithful is False
    assert res_h.faithfulness_score < 0.75
    assert len(res_h.unsupported_claims) > 0


def test_citation_validation():
    """Verify citation validator verifies genuine URLs and rejects fabricated ones."""
    validator = CitationValidator()
    context = [{
        "metadata": {
            "title": "PM SVANidhi Scheme",
            "department": "Ministry Of Housing & Urban Affairs",
            "source_url": "https://www.myscheme.gov.in/schemes/pm-svanidhi",
            "publication_date": "2026-10-31"
        }
    }]

    citations = [
        {
            "title": "PM SVANidhi",
            "department": "Ministry Of Housing & Urban Affairs",
            "url": "https://www.myscheme.gov.in/schemes/pm-svanidhi"
        },
        {
            "title": "Fake Free Grants",
            "department": "Fake Ministry",
            "url": "https://fakegovernmentgrants.com/claim-now"
        }
    ]

    result = validator.validate_citations(citations, context)
    assert result.valid_citations == 1
    assert result.invalid_citations == 1
    assert result.all_valid is False
    assert result.verified_sources[0].url == "https://www.myscheme.gov.in/schemes/pm-svanidhi"
    assert result.verified_sources[0].last_verified_date is not None


def test_conditional_routing_logic():
    """Verify all LangGraph conditional routing decisions and termination guards."""
    # 1. Post-retrieval routing
    state_rel = RAGState(retrieval_evaluation={"is_relevant": True, "relevance_score": 0.85})
    assert route_after_retrieval_evaluation(state_rel) == "source_verification"

    state_irrel = RAGState(retrieval_evaluation={"is_relevant": False, "relevance_score": 0.20})
    assert route_after_retrieval_evaluation(state_irrel) == "knowledge_refinement"

    # 2. Post-refinement routing
    state_refine_ok = RAGState(refinement_attempts=1, knowledge_refinement_queries=["eligibility query"])
    assert route_after_knowledge_refinement(state_refine_ok) == "query_rewriting"

    state_refine_exhausted = RAGState(refinement_attempts=2, knowledge_refinement_queries=["eligibility query"])
    assert route_after_knowledge_refinement(state_refine_exhausted) == "controlled_fallback"

    # 3. Post-answerability routing
    state_ans_ok = RAGState(answerability_result={"is_answerable": True, "answerability_score": 0.85})
    assert route_after_answerability(state_ans_ok) == "answer_generation"

    state_ans_fail = RAGState(answerability_result={"is_answerable": False, "answerability_score": 0.30}, refinement_attempts=0)
    assert route_after_answerability(state_ans_fail) == "knowledge_refinement"

    # 4. Post-faithfulness routing
    state_f_ok = RAGState(faithfulness_result={"is_faithful": True, "faithfulness_score": 0.95})
    assert route_after_faithfulness(state_f_ok) == "citation_validation"

    state_f_regen = RAGState(faithfulness_result={"is_faithful": False, "faithfulness_score": 0.40}, generation_attempts=1)
    assert route_after_faithfulness(state_f_regen) == "answer_generation"

    state_f_exhausted = RAGState(faithfulness_result={"is_faithful": False, "faithfulness_score": 0.40}, generation_attempts=2)
    assert route_after_faithfulness(state_f_exhausted) == "controlled_fallback"
