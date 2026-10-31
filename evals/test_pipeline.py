"""
End-to-End Pipeline Evaluation Benchmark.
Measures Answer Correctness, Citation Correctness, Hallucination Rate,
and Retrieval Failure Handling across both in-domain and out-of-domain queries.
"""

import os
import sys
import json
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.graph.workflow import build_query_retrieval_graph
from app.graph.state import RAGState
from app.evaluation.rag_eval import (
    evaluate_citation_correctness,
    evaluate_retrieval_failure_handling,
    evaluate_answer_correctness_simple,
    evaluate_hallucination_rate
)


def run_pipeline_eval():
    print("=" * 60)
    print("RUNNING END-TO-END RAG PIPELINE EVALUATION BENCHMARK")
    print("=" * 60)

    dataset_path = os.path.join("evals", "test_dataset.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    graph = build_query_retrieval_graph()

    answer_correctness_list = []
    citation_correctness_list = []
    hallucination_rates = []
    failure_handling_scores = []

    for item in dataset:
        qid = item["id"]
        query = item["query"]
        is_in_domain = item.get("is_in_domain", True)
        ground_truth = item.get("ground_truth_answer", "")
        expected_url = item.get("expected_url_substr")

        print(f"\n[Case {qid}] Query: '{query}'")
        state = graph.invoke(RAGState(original_query=query))

        final_answer = state.get("final_answer", "")
        citations = state.get("citations", [])
        eval_result = state.get("evaluation_result", {})
        reranked = state.get("reranked_documents", [])
        context = "\n".join(d.get("page_content", "") for d in reranked)

        # 1. Retrieval Failure Handling
        fail_score = evaluate_retrieval_failure_handling(is_in_domain, final_answer, eval_result)
        failure_handling_scores.append(fail_score)

        if is_in_domain:
            # 2. Answer Correctness
            ans_score = evaluate_answer_correctness_simple(final_answer, ground_truth)
            answer_correctness_list.append(ans_score)

            # 3. Citation Correctness
            cit_score = evaluate_citation_correctness(citations, expected_url)
            citation_correctness_list.append(cit_score)

            # 4. Hallucination Rate
            hal_rate = evaluate_hallucination_rate(final_answer, context)
            hallucination_rates.append(hal_rate)

            print(f"  In-Domain Result: Correctness={ans_score:.2f} | Citation={cit_score:.2f} | HallucinationRate={hal_rate:.3f}")
            print(f"  Citations Count: {len(citations)}")
        else:
            print(f"  Negative/Out-of-Domain Result: Correctly Rejected={fail_score == 1.0}")
            print(f"  Response: '{final_answer[:80]}...'")

    mean_ans_correctness = float(np.mean(answer_correctness_list)) if answer_correctness_list else 1.0
    mean_cit_correctness = float(np.mean(citation_correctness_list)) if citation_correctness_list else 1.0
    mean_hallucination = float(np.mean(hallucination_rates)) if hallucination_rates else 0.0
    mean_failure_handling = float(np.mean(failure_handling_scores))

    print("\n" + "=" * 60)
    print("END-TO-END BENCHMARK SUMMARY REPORT")
    print("=" * 60)
    print(f"  Answer Correctness           : {mean_ans_correctness:.4f}")
    print(f"  Citation Correctness         : {mean_cit_correctness:.4f}")
    print(f"  Hallucination Rate (lower=better): {mean_hallucination:.4f}")
    print(f"  Retrieval Failure Handling   : {mean_failure_handling * 100.0:.1f}%")
    print("=" * 60)

    assert mean_failure_handling == 1.0, "All out-of-domain queries must trigger controlled failure."
    assert mean_cit_correctness >= 0.75, "Citation correctness must be >= 75%."
    assert mean_hallucination <= 0.35, "Hallucination rate must be low."

    print("\n[SUCCESS] End-to-end RAG pipeline evaluation passed successfully!")
    return {
        "answer_correctness": mean_ans_correctness,
        "citation_correctness": mean_cit_correctness,
        "hallucination_rate": mean_hallucination,
        "failure_handling": mean_failure_handling
    }


if __name__ == "__main__":
    run_pipeline_eval()
