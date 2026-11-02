"""
Faithfulness Evaluation Module.
Inspects generated answers against retrieved context to detect hallucinations,
verify numerical figures, dates, and eligibility rules, and flags unsupported claims.
"""

import json
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from groq import Groq

from app.config.settings import get_settings


class FaithfulnessEvaluation(BaseModel):
    """Structured Pydantic model for faithfulness evaluation."""

    is_faithful: bool = Field(
        description="Whether every factual claim in the generated answer is grounded in the retrieved context"
    )
    faithfulness_score: float = Field(
        description="Score between 0.0 and 1.0 (1.0 = completely faithful, 0.0 = completely hallucinated)",
        ge=0.0,
        le=1.0
    )
    unsupported_claims: List[str] = Field(
        default_factory=list,
        description="List of specific claims, figures, dates, or eligibility rules not supported by context"
    )
    reason: str = Field(
        description="Detailed analytical explanation of faithfulness assessment"
    )


class FaithfulnessEvaluator:
    """Rigorous factual verification evaluator for generated government responses."""

    def __init__(self):
        self.settings = get_settings()
        self.client = Groq(api_key=self.settings.GROQ_API_KEY) if self.settings.GROQ_API_KEY else None
        self.threshold = 0.80

    def evaluate(
        self,
        answer: str,
        context_documents: List[Dict[str, Any]]
    ) -> FaithfulnessEvaluation:
        """
        Validates that all statements in the answer are strictly supported by the context.
        """
        # If the answer is the controlled refusal (in English or any Indic language), it is by definition faithful
        ans_lower = answer.lower()
        if (
            "don't have sufficient verified information" in ans_lower
            or "सत्यापित जानकारी" in answer
            or "ధృవీకరించబడిన సమాచారం లేదు" in answer
            or "சரிபார்க்கப்பட்ட தகவல்கள் இல்லை" in answer
            or "যাচাইকৃত তথ্য নেই" in answer
            or "ಪರಿಶೀಲಿಸಿದ ಮಾಹಿತಿ ಇಲ್ಲ" in answer
            or "പരിശോധിച്ച വിവരങ്ങൾ ലഭ്യമല്ല" in answer
            or "पडताळलेली माहिती उपलब्ध नाही" in answer
            or "ચકાસાયેલ માહિતી નથી" in answer
            or "ਪ੍ਰਮਾਣਿਤ ਜਾਣਕਾਰੀ ਨਹੀਂ ਹੈ" in answer
            or "ପ୍ରମାଣିତ ସୂଚନା ନାହିଁ" in answer
            or "تصدیق شدہ معلومات نہیں ہیں" in answer
            or "পৰীক্ষিত তথ্য নাই" in answer
        ):
            return FaithfulnessEvaluation(
                is_faithful=True,
                faithfulness_score=1.0,
                unsupported_claims=[],
                reason="Controlled refusal response contains no ungrounded factual claims."
            )

        if not context_documents:
            return FaithfulnessEvaluation(
                is_faithful=False,
                faithfulness_score=0.0,
                unsupported_claims=["Entire answer generated without supporting context"],
                reason="No supporting context documents provided."
            )

        if not self.client:
            return self._heuristic_evaluate(answer, context_documents)

        context_snippets = []
        for idx, doc in enumerate(context_documents[:5]):
            meta = doc.get("metadata", {})
            title = meta.get("title", f"Doc {idx+1}")
            dept = meta.get("department", "Government of India")
            url = meta.get("source_url") or meta.get("url", "")
            pub_date = str(meta.get("publication_date") or meta.get("last_updated", ""))[:10]
            content = doc.get("page_content", "")[:800]
            context_snippets.append(
                f"[Source {idx+1}] Title: {title} | Department: {dept} | URL: {url} | Date: {pub_date}\n{content}"
            )
        joined_context = "\n\n---\n\n".join(context_snippets)

        system_prompt = (
            "You are a strict Government Information Faithfulness Evaluator.\n"
            "Compare the Generated Answer against the Verified Context.\n\n"
            "Responsibilities:\n"
            "1. Check if the factual claims, loan amounts, subsidy percentages, and eligibility criteria in the Answer are grounded in the Context.\n"
            "2. Note: Source metadata (departments, URLs, scheme titles) provided in the source headers are fully verified context.\n"
            "3. Identify any fabricated financial figures, invented scheme rules, or false promises.\n"
            "4. If core financial/eligibility facts are fabricated or contradictory to the text, list them in unsupported_claims and set is_faithful=false.\n\n"
            "Return strictly a JSON object matching:\n"
            "{\n"
            '  "is_faithful": true,\n'
            '  "faithfulness_score": 0.95,\n'
            '  "unsupported_claims": [],\n'
            '  "reason": "All factual statements regarding loan slabs and eligibility are substantiated by the text."\n'
            "}\n"
            "Rules:\n"
            "- If there are unsupported claims, set is_faithful=false, list them, and assign score < 0.75.\n"
            "- Output valid JSON only."
        )

        user_prompt = f"Verified Context:\n{joined_context}\n\nGenerated Answer to Verify:\n{answer}"

        models_to_try = [m for m in [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL] if "20b" not in m.lower()]
        for model in models_to_try:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.0,
                    max_tokens=800,
                    response_format={"type": "json_object"} if "qwen" in model else None,
                    timeout=8.0
                )
                content = response.choices[0].message.content or ""
                clean_json = self._extract_json(content)
                if clean_json:
                    data = json.loads(clean_json)
                    return FaithfulnessEvaluation(**data)
            except Exception as e:
                print(f"[FaithfulnessEvaluator] Warning with model {model}: {e}")

        return self._heuristic_evaluate(answer, context_documents)

    def _extract_json(self, text: str) -> Optional[str]:
        text = text.strip()
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1).strip()
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return text[start:end + 1]
        return None

    @staticmethod
    def _extract_numbers(text: str) -> set:
        """
        Extracts numeric values from text, normalising Western and Indian digit
        grouping (e.g. '6,000' and '5,00,000') into plain digit strings so that
        formatting differences never look like hallucinated figures.
        """
        values = set()
        for raw in re.findall(r"\d[\d,]*(?:\.\d+)?", text):
            cleaned = raw.replace(",", "").rstrip(".")
            if not cleaned:
                continue
            try:
                numeric = float(cleaned)
            except ValueError:
                continue
            if numeric.is_integer():
                values.add(str(int(numeric)))
            else:
                values.add(("%f" % numeric).rstrip("0").rstrip("."))
        return values

    def _heuristic_evaluate(
        self,
        answer: str,
        context_documents: List[Dict[str, Any]]
    ) -> FaithfulnessEvaluation:
        """Deterministic numerical and keyword overlap check."""
        combined_context = " ".join(d.get("page_content", "") for d in context_documents).lower()
        ans_lower = answer.lower()

        # Normalize numbers by removing commas (e.g. 6,000 -> 6000,
        # Indian lakh grouping 5,00,000 -> 500000)
        ans_clean = self._extract_numbers(answer)
        ctx_clean = self._extract_numbers(combined_context)

        ignored_numbers = {
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
            "12", "15", "18", "20", "21", "25", "30", "35", "50", "60", "100",
            "2014", "2015", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"
        }
        unsupported_nums = [
            n for n in ans_clean
            if n not in ctx_clean and len(n) > 2 and n not in ignored_numbers
        ]
        is_f = len(unsupported_nums) == 0
        score = 0.95 if is_f else 0.50

        unsupported = [f"Unsupported figure: {n}" for n in unsupported_nums]

        return FaithfulnessEvaluation(
            is_faithful=is_f,
            faithfulness_score=score,
            unsupported_claims=unsupported,
            reason="All figures verified in context." if is_f else f"Found unsupported figures: {', '.join(unsupported_nums)}"
        )
