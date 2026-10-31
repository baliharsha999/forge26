"""
Query Decomposition Agent.
Deconstructs complex user queries into focused, searchable subqueries
targeting distinct informational requirements while preserving user intent.
"""

import json
import re
from typing import List, Optional
from pydantic import BaseModel, Field
from groq import Groq
from app.config.settings import get_settings


class QueryDecomposition(BaseModel):
    """Structured Pydantic model for query decomposition."""

    original_query: str = Field(description="The original user query")
    subqueries: List[str] = Field(
        default_factory=list,
        description="Focused, atomic subqueries capturing each distinct informational requirement"
    )
    information_requirements: List[str] = Field(
        default_factory=list,
        description="List of specific information pieces needed (e.g., eligibility, subsidies, process)"
    )
    target_departments: List[str] = Field(
        default_factory=list,
        description="Relevant central or state ministries/departments"
    )
    categories: List[str] = Field(
        default_factory=list,
        description="Government policy categories (e.g. Education, MSME, Agriculture, Social Security)"
    )


class QueryDecompositionAgent:
    """Decomposes compound or multi-faceted queries into targeted subqueries."""

    def __init__(self):
        self.settings = get_settings()
        self.client = Groq(api_key=self.settings.GROQ_API_KEY) if self.settings.GROQ_API_KEY else None

    def decompose(self, query: str) -> QueryDecomposition:
        """Analyzes and decomposes the user query into structured subqueries."""
        if not self.client:
            return self._heuristic_decomposition(query)

        system_prompt = (
            "You are an expert Government Information Query Decomposition Agent.\n"
            "Your task is to break complex, multi-part questions about Indian government schemes, "
            "subsidies, and policies into smaller, atomic, searchable subqueries.\n\n"
            "Responsibilities:\n"
            "1. Identify every distinct information requirement (e.g., eligibility, benefits, application process, loan limits).\n"
            "2. Generate 3 to 5 clear, searchable subqueries targeting official government documents.\n"
            "3. Identify relevant government departments/ministries and categories.\n"
            "4. Strictly preserve the original user intent.\n\n"
            "Return ONLY a JSON object matching this schema:\n"
            "{\n"
            '  "original_query": "the original question",\n'
            '  "subqueries": [\n'
            '    "subquery 1",\n'
            '    "subquery 2"\n'
            '  ],\n'
            '  "information_requirements": [\n'
            '    "Eligibility criteria",\n'
            '    "Financial assistance amount"\n'
            '  ],\n'
            '  "target_departments": ["Ministry of MSME"],\n'
            '  "categories": ["Business & Entrepreneurship"]\n'
            "}\n"
            "Output must be strictly raw JSON without markdown code fences or conversational text."
        )

        user_prompt = f"User query: \"{query}\""

        models_to_try = [m for m in [self.settings.GROQ_MODEL, self.settings.FALLBACK_MODEL] if "20b" not in m.lower()]
        for model in models_to_try:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=500,
                    response_format={"type": "json_object"} if "qwen" in model else None,
                    timeout=8.0
                )

                content = response.choices[0].message.content or ""
                clean_json = self._extract_json(content)
                if clean_json:
                    data = json.loads(clean_json)
                    data["original_query"] = query
                    return QueryDecomposition(**data)
            except Exception as e:
                print(f"[DecompositionAgent] Model {model} warning: {e}. Trying fallback...")

        return self._heuristic_decomposition(query)

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

    def _heuristic_decomposition(self, query: str) -> QueryDecomposition:
        """Deterministic decomposition fallback."""
        q_lower = query.lower()
        subqueries = []
        reqs = []

        # Identify requirements
        if any(w in q_lower for w in ["eligib", "who can", "criteria", "age"]):
            reqs.append("Eligibility criteria and qualification")
            subqueries.append(f"{query} eligibility criteria and qualifications")
        if any(w in q_lower for w in ["benefit", "subsidy", "amount", "loan", "financial", "money"]):
            reqs.append("Financial benefits and subsidies")
            subqueries.append(f"{query} financial assistance and subsidy amount")
        if any(w in q_lower for w in ["apply", "process", "procedure", "document", "how to"]):
            reqs.append("Application procedure and documents")
            subqueries.append(f"{query} application process and documents required")
        if any(w in q_lower for w in ["student", "engineer", "scholarship", "college", "school", "education"]):
            reqs.append("Educational qualifications and scholarship coverage")
            subqueries.append(f"{query} educational scholarship and student grant")

        if len(subqueries) < 2:
            subqueries.append(f"{query} eligibility guidelines and requirements")
            reqs.append("Scheme eligibility guidelines")

        if not subqueries:
            subqueries = [
                query,
                f"Official government scheme for {query}",
                f"{query} eligibility and benefits"
            ]
            reqs = ["General scheme overview", "Benefits"]

        # Department detection
        departments = []
        if any(w in q_lower for w in ["business", "msme", "startup", "entrepreneur"]):
            departments.append("Ministry of Micro, Small and Medium Enterprises")
        if any(w in q_lower for w in ["student", "scholarship", "engineering", "education"]):
            departments.append("Ministry of Education")
        if any(w in q_lower for w in ["farm", "kisan", "crop", "agriculture"]):
            departments.append("Ministry of Agriculture and Farmers Welfare")
        if not departments:
            departments.append("Government of India")

        return QueryDecomposition(
            original_query=query,
            subqueries=subqueries,
            information_requirements=reqs,
            target_departments=departments,
            categories=["Government Schemes & Welfare"]
        )
