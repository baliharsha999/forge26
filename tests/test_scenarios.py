"""
Scenario-Based Integration Tests for Advanced Government Information RAG System:
Scenario A: All required information is retrieved -> Grounded answer with citations.
Scenario B: Relevant documents found but important information missing -> Knowledge refinement loop.
Scenario C: No relevant documents found (out of domain) -> Controlled fallback.
Scenario D: Generated answer contains unsupported information -> Faithfulness evaluation detects & triggers regeneration.
Scenario E: Retrieved document is outdated -> Source verification identifies age & system qualifies currency.
Scenario F: Two documents contain conflicting information -> System identifies conflict & distinguishes dates/authorities.
"""

import pytest
from app.graph.workflow import build_query_retrieval_graph
from app.graph.state import RAGState
from app.agents.verification_agent import SourceVerificationAgent
from app.agents.refinement_agent import KnowledgeRefinementAgent
from app.evaluation.faithfulness_eval import FaithfulnessEvaluator
from app.generation.answer_generator import AnswerGenerator


@pytest.fixture(scope="module")
def rag_graph():
    return build_query_retrieval_graph()


def test_scenario_a_complete_retrieval(rag_graph):
    """Scenario A: All required information is available in indexed documents."""
    query = "What financial benefits can I get from the government if I am starting a small business?"
    state = rag_graph.invoke(RAGState(original_query=query))

    assert state.get("final_answer") != ""
    assert "don't have sufficient verified information" not in state.get("final_answer").lower()
    assert len(state.get("citations", [])) > 0
    # Citations must be official
    assert any(".gov.in" in c.get("url", "") for c in state["citations"])
    assert state.get("faithfulness_result", {}).get("is_faithful") is True


def test_scenario_b_missing_info_knowledge_refinement():
    """Scenario B: Relevant documents found but important information is missing -> Refinement."""
    agent = KnowledgeRefinementAgent()
    query = "What are the eligibility criteria and documents required for PMEGP loan subsidy?"
    partial_context = [
        {"page_content": "PMEGP provides up to 35% capital subsidy for setting up new micro-enterprises in rural areas."}
    ]

    analysis = agent.analyze_and_refine(query, partial_context, current_attempt=0)
    assert analysis.should_continue_refinement is True
    assert len(analysis.targeted_queries) >= 1
    # Check that targeted query specifically searches for eligibility / documents
    assert any("eligib" in q.lower() or "document" in q.lower() for q in analysis.targeted_queries)


def test_scenario_c_out_of_domain_controlled_fallback(rag_graph):
    """Scenario C: No relevant documents are found (out of domain) -> Controlled fallback."""
    query = "What are the secret cheat codes to spawn helicopters in GTA 5?"
    state = rag_graph.invoke(RAGState(original_query=query))

    fallback_phrase = "don't have sufficient verified information"
    assert fallback_phrase in state.get("final_answer", "").lower()
    assert len(state.get("citations", [])) == 0


def test_scenario_d_faithfulness_and_regeneration():
    """Scenario D: Answer contains unsupported figures -> Faithfulness flags and guides regeneration."""
    evaluator = FaithfulnessEvaluator()
    generator = AnswerGenerator()

    context = [{
        "page_content": "PMMY Shishu covers loans up to Rs. 50,000. Kishore covers loans above Rs. 50,000 and up to Rs. 5 Lakhs."
    }]

    hallucinated_answer = (
        "Under PMMY, Shishu offers loans up to Rs. 10 Lakhs with 0% interest and a guaranteed free computer."
    )

    f_eval = evaluator.evaluate(hallucinated_answer, context)
    assert f_eval.is_faithful is False
    assert len(f_eval.unsupported_claims) > 0

    # Regenerate with evaluator feedback
    feedback = f"Remove unsupported figures: {'; '.join(f_eval.unsupported_claims)}"
    regenerated = generator.generate(
        query="What are PMMY loan limits?",
        retrieved_documents=context,
        evaluator_feedback=feedback
    )

    # Regenerated answer should not have the hallucinated 0% or free computer
    assert "free computer" not in regenerated.answer.lower()


def test_scenario_e_outdated_document_qualification():
    """Scenario E: Retrieved document is outdated -> Source verification identifies age & system qualifies it."""
    verification_agent = SourceVerificationAgent()
    generator = AnswerGenerator()

    outdated_doc = {
        "page_content": "Under the 2014 Solar Rooftop Scheme, financial assistance of Rs. 20,000 per kW was provided.",
        "metadata": {
            "title": "National Solar Mission Guidelines 2014",
            "department": "Ministry of New and Renewable Energy",
            "publication_date": "2014-03-01",
            "last_updated": "2014-03-01",
            "source_url": "https://mnre.gov.in/solar-2014"
        }
    }

    verified_list = verification_agent.verify_documents([outdated_doc])
    v_item = verified_list[0]["source_verification"]
    assert v_item["is_outdated"] is True
    assert v_item["age_in_years"] >= 10.0
    assert v_item["status"] == "VERIFIED_OFFICIAL_OUTDATED"

    # Answer generation with outdated qualification
    res = generator.generate(
        query="What is the rooftop solar subsidy?",
        retrieved_documents=verified_list
    )
    ans_lower = res.answer.lower()
    # Ensure answer notes earlier/past policy context
    assert any(term in ans_lower for term in ["earlier", "2014", "older", "guidelines", "reflects", "national solar mission"])


def test_scenario_f_conflicting_documents_resolution():
    """Scenario F: Two documents contain conflicting info -> System compares dates/authorities without conflating."""
    generator = AnswerGenerator()

    doc_earlier = {
        "page_content": "Under the 2020 Guidelines, maximum loan limit under Mudra Tarun is Rs. 10 Lakhs.",
        "metadata": {
            "title": "PMMY Circular 2020",
            "department": "Department of Financial Services",
            "publication_date": "2020-01-01",
            "source_url": "https://financialservices.gov.in/pmmy-2020"
        },
        "source_verification": {"is_outdated": True}
    }

    doc_later = {
        "page_content": "Under Union Budget 2024 revision, the limit for Mudra loans under Tarun Plus category is enhanced to Rs. 20 Lakhs for entrepreneurs who have previously availed and successfully repaid Tarun loans.",
        "metadata": {
            "title": "PMMY Enhanced Guidelines 2024",
            "department": "Ministry of Finance",
            "publication_date": "2024-07-23",
            "source_url": "https://financialservices.gov.in/pmmy-2024-update"
        },
        "source_verification": {"is_outdated": False}
    }

    res = generator.generate(
        query="What is the maximum loan limit under Tarun in Mudra Yojana?",
        retrieved_documents=[doc_later, doc_earlier]
    )

    ans_text = res.answer
    # System should explicitly acknowledge the enhancement or distinguish between earlier Rs. 10 Lakh and updated Rs. 20 Lakh
    assert "20" in ans_text and "10" in ans_text
    assert len(res.sources) >= 2
