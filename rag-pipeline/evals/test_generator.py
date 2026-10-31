"""
Generator Evaluation Benchmark.
Measures Faithfulness, Answer Relevancy, and Contextual Relevancy.
"""

import os
import sys
import json
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.graph.workflow import build_query_retrieval_graph
from app.graph.state import RAGState
from app.evaluation.generator_eval import GeneratorEvaluator


def run_generator_eval():
    print("=" * 60)
    print("RUNNING GENERATOR EVALUATION BENCHMARK")
    print("=" * 60)

    dataset_path = os.path.join("evals", "test_dataset.json")
    with open(dataset_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    # In-domain test cases where generator produces factual answers
    test_cases = [d for d in dataset if d.get("is_in_domain", True)]
    graph = build_query_retrieval_graph()
    evaluator = GeneratorEvaluator()

    faithfulness_scores = []
    relevancy_scores = []
    context_relevancy_scores = []

    for item in test_cases[:3]:  # Run on representative sample
        query = item["query"]
        print(f"\nEvaluating query: '{query}'")

        state = graph.invoke(RAGState(original_query=query))
        answer = state.get("final_answer", "")
        reranked = state.get("reranked_documents", [])
        context = "\n".join(d.get("page_content", "") for d in reranked)

        scores = evaluator.evaluate(query=query, answer=answer, context=context)

        f_score = scores["faithfulness"]
        r_score = scores["answer_relevancy"]
        c_score = scores["contextual_relevancy"]

        faithfulness_scores.append(f_score)
        relevancy_scores.append(r_score)
        context_relevancy_scores.append(c_score)

        print(f"  Faithfulness: {f_score:.3f} | Answer Relevancy: {r_score:.3f} | Contextual Relevancy: {c_score:.3f}")

    avg_faithfulness = float(np.mean(faithfulness_scores))
    avg_relevancy = float(np.mean(relevancy_scores))
    avg_context_relevancy = float(np.mean(context_relevancy_scores))

    print("\n" + "-" * 50)
    print("--- Generator Evaluation Summary ---")
    print(f"  Mean Faithfulness       : {avg_faithfulness:.4f}")
    print(f"  Mean Answer Relevancy   : {avg_relevancy:.4f}")
    print(f"  Mean Contextual Relevancy: {avg_context_relevancy:.4f}")

    assert avg_faithfulness >= 0.70, "Faithfulness should be >= 0.70"
    assert avg_relevancy >= 0.65, "Answer relevancy should be >= 0.65"
    print("\n[SUCCESS] Generator evaluation passed successfully!")
    return {
        "faithfulness": avg_faithfulness,
        "answer_relevancy": avg_relevancy,
        "contextual_relevancy": avg_context_relevancy
    }


if __name__ == "__main__":
    run_generator_eval()
