"""
Scheme Assistant Agent
Combines real-time web scraping of myscheme.gov.in with LLM reasoning to evaluate
user eligibility, explain benefits, and deliver the complete scraped HTML document.
"""

import os
import re
import json
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
from groq import Groq

# Load environment configuration from current or workspace directory
load_dotenv(r"d:\forge26\.env")
load_dotenv(r"C:\Users\HARSHA\OneDrive\Desktop\scheme-assistant\.env")

from db import SchemeDatabase, DEFAULT_DB_PATH
from scraper import MySchemeScraper


class SchemeAgent:
    def __init__(self, data_dir: str = r"d:\forge26\data", db_path: str = DEFAULT_DB_PATH):
        self.scraper = MySchemeScraper(data_dir=data_dir, db_path=db_path)
        self.db = self.scraper.db
        self.api_key = os.getenv("GROQ_API_KEY", "")
        self.primary_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self.fallback_model = os.getenv("FALLBACK_MODEL", "qwen/qwen3.8-27b")
        
        self.client = None
        if self.api_key:
            try:
                self.client = Groq(api_key=self.api_key)
            except Exception as e:
                print(f"[Warning] Failed to initialize Groq client: {e}")

    def _call_llm(self, system_prompt: str, user_prompt: str, max_tokens: int = 1500) -> str:
        """Calls Groq LLM with primary model and automatic fallback."""
        if not self.client:
            return ""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        # Try primary model first
        for model_name in [self.primary_model, self.fallback_model, "qwen/qwen3.8-27b"]:
            if not model_name:
                continue
            try:
                resp = self.client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.2,
                    max_tokens=max_tokens
                )
                content = resp.choices[0].message.content or ""
                if content.strip():
                    return content.strip()
            except Exception as e:
                print(f"[Warning] Call to model '{model_name}' failed: {e}")
                continue

        return ""

    def extract_scheme_intent(self, user_query: str) -> Optional[str]:
        """
        Uses LLM or regex to extract scheme name/keywords from user query.
        Returns a search phrase or slug candidate.
        """
        system_prompt = (
            "You are a government welfare scheme intent extractor. "
            "Given a user message, extract ONLY the name, acronym, or keywords of the specific government scheme "
            "they are asking about (for example: 'PM-KISAN', 'PMAY', 'Mudra Loan', 'Ayushman Bharat', 'Sukanya Samriddhi'). "
            "If the user is asking a broad question without mentioning any specific scheme, output 'NONE'. "
            "Do not explain. Output only the extracted scheme name or 'NONE'."
        )

        extracted = self._call_llm(system_prompt, user_query, max_tokens=30)
        if extracted and "NONE" not in extracted.upper():
            # Clean punctuation
            clean = re.sub(r'["\']', '', extracted).strip()
            return clean

        # Heuristic fallback: check if any common scheme alias is in user query
        q_lower = user_query.lower()
        common_keywords = [
            "pm kisan", "pm-kisan", "pmay", "awas", "pmmvy", "matru vandana",
            "mudra", "pmmy", "svanidhi", "ayushman", "pmjay", "sukanya",
            "atal pension", "apy", "kisan credit", "kcc", "scholarship", "solar"
        ]
        for kw in common_keywords:
            if kw in q_lower:
                return kw

        return None

    def evaluate_eligibility(self, user_query: str, scheme_bundle: Dict[str, Any]) -> Dict[str, Any]:
        """
        Uses LLM to evaluate user eligibility point-by-point against official scraped criteria.
        """
        text_summary = scheme_bundle.get("text_summary", "")
        basic = scheme_bundle.get("details", {}).get("basicDetails", {})
        scheme_name = basic.get("schemeName", scheme_bundle.get("slug"))
        short_title = basic.get("schemeShortTitle", scheme_bundle.get("slug"))

        system_prompt = f"""
You are an expert Government Welfare Scheme Counselor for India.
You have access to the OFFICIAL, LIVE SCRAPED data from myscheme.gov.in for the scheme:
{scheme_name} ({short_title})

Your task is to:
1. Carefully analyze the user's situation/profile provided in their question.
2. Cross-reference it with the Official Eligibility Criteria and Exclusions of this scheme.
3. Determine their eligibility status:
   - [ELIGIBLE] (User meets all criteria and has no disqualifications)
   - [LIKELY ELIGIBLE] (User appears to meet core criteria, some minor condition to verify)
   - [NOT ELIGIBLE] (User clearly violates a criterion or falls under an exclusion)
   - [NEED MORE INFO] (Insufficient details provided about land, income, age, occupation, etc.)

Format your response in clear, citizen-friendly Markdown with the following sections:
### 🏛️ Scheme Identified
**{scheme_name}** ({short_title})

### 🎯 Eligibility Verdict
State the verdict clearly: **[ELIGIBLE]** / **[LIKELY ELIGIBLE]** / **[NOT ELIGIBLE]** / **[NEED MORE INFORMATION]**.
Provide a clear 2-3 sentence direct explanation of why.

### 📋 Criteria Checklist
- List each relevant eligibility rule and mark it:
  - ✅ **Met**: [Rule explanation matching user's situation]
  - ❌ **Unmet**: [Rule violation or disqualification]
  - ℹ️ **To Verify / Needs Details**: [Any condition not specified by user]

### 💰 Key Benefits
- Bullet points of exact financial support, subsidies, or services provided.

### 📄 Mandatory Documents Required
- List key documents the applicant must prepare.

### 🚀 Next Steps to Apply
- Step-by-step instructions (online portal link or offline office).
"""

        user_prompt = f"""
OFFICIAL SCHEME DATA (Scraped from myscheme.gov.in):
{text_summary}

USER QUESTION / PROFILE:
"{user_query}"

Evaluate the user's eligibility and answer their question based strictly on the scraped official data.
"""

        answer = self._call_llm(system_prompt, user_prompt, max_tokens=1500)

        # Fallback heuristic if LLM output is empty
        if not answer:
            answer = f"""
### 🏛️ Scheme Identified: {scheme_name} ({short_title})

### 🎯 Overview & Eligibility
**Official Criteria:**
{scheme_bundle.get('details', {}).get('eligibilityCriteria', {}).get('eligibilityDescription_md', 'Please check the generated HTML dossier for full criteria.')}

### 💰 Benefits
{scheme_bundle.get('details', {}).get('schemeContent', {}).get('benefits_md', 'Financial assistance provided as per scheme rules.')}

### 📄 Total HTML File Available
The complete scheme dossier has been scraped and compiled into a standalone HTML file.
"""

        # Determine verdict keyword for UI badges
        verdict = "INFO"
        if "NOT ELIGIBLE" in answer.upper():
            verdict = "NOT ELIGIBLE"
        elif "LIKELY ELIGIBLE" in answer.upper():
            verdict = "LIKELY ELIGIBLE"
        elif "ELIGIBLE" in answer.upper() and "[NOT ELIGIBLE]" not in answer.upper():
            verdict = "ELIGIBLE"
        elif "NEED MORE" in answer.upper():
            verdict = "NEED MORE INFO"

        return {
            "verdict": verdict,
            "answer_markdown": answer
        }

    def process_chat(self, user_query: str, session_id: str = "default_session") -> Dict[str, Any]:
        """
        Main Agent chat entry point:
        1. Identifies scheme in query or handles general questions.
        2. Web-scrapes the specific scheme from myscheme.gov.in.
        3. Stores the total HTML document and structured metadata directly into SQLite DB.
        4. Analyzes eligibility using LLM.
        5. Saves interaction history to SQLite DB and returns result package.
        """
        user_query = user_query.strip()
        print(f"\n[Agent] Received user query: '{user_query}'")

        # Step 1: Detect scheme intent
        detected_keyword = self.extract_scheme_intent(user_query)
        print(f"[Agent] Detected scheme intent keyword: '{detected_keyword}'")

        search_query = detected_keyword if detected_keyword else user_query
        matches = self.scraper.search_schemes(search_query, top_k=3)

        if not matches:
            # Fallback search with raw user query words
            matches = self.scraper.search_schemes(user_query, top_k=3)

        if not matches:
            msg = (
                "I couldn't find a matching government scheme on myscheme.gov.in for your query. "
                "Please specify the name of the scheme (e.g. PM-KISAN, PMAY Urban, PM Mudra, PM Matru Vandana, etc.) "
                "or describe the sector you need assistance with (farming, housing, business loan, health)."
            )
            self.db.save_chat_interaction(
                session_id=session_id,
                user_query=user_query,
                matched_slug=None,
                scheme_name=None,
                eligibility_verdict="NO_MATCH",
                agent_response=msg
            )
            return {
                "success": False,
                "message": msg,
                "scheme_matched": None,
                "files": None
            }

        target_scheme = matches[0]
        slug = target_scheme.get("slug")
        scheme_name = target_scheme.get("en", {}).get("basicDetails", {}).get("schemeName") or slug

        print(f"[Agent] Matched target scheme: '{scheme_name}' (slug: {slug})")

        # Step 2: Scrape live data & save directly into SQLite DB
        try:
            scheme_bundle = self.scraper.scrape_and_save(slug)
        except Exception as e:
            err_msg = f"Encountered an error while scraping scheme details for '{slug}' from myscheme.gov.in: {str(e)}"
            print(f"[Agent] Error scraping scheme: {err_msg}")
            return {
                "success": False,
                "message": err_msg,
                "scheme_matched": {"slug": slug, "name": scheme_name},
                "files": None
            }

        # Step 3: LLM Eligibility Evaluation
        eval_result = self.evaluate_eligibility(user_query, scheme_bundle)

        # Step 4: Prepare database notification in answer
        db_record_id = scheme_bundle.get("db_id")
        html_content = scheme_bundle.get("total_html_content", "")
        raw_html_content = scheme_bundle.get("raw_html_content", "")
        html_size_kb = round(len(html_content.encode("utf-8")) / 1024, 1)

        final_answer = eval_result["answer_markdown"] + f"""

---
### 🗄️ SQL Database Record Stored
- **Database File:** `{self.db.db_path}`
- **Table Name:** `schemes` (Record ID: `#{db_record_id}`)
- **Stored Scheme Slug:** `{slug}`
- **HTML Payload Stored in DB:** `{html_size_kb} KB`
- **Official Source:** [myscheme.gov.in/schemes/{slug}](https://www.myscheme.gov.in/schemes/{slug})

*(The total HTML file is stored directly inside the SQL database and is accessible for preview and export below.)*
"""

        # Step 5: Save interaction to SQL chat_history table
        self.db.save_chat_interaction(
            session_id=session_id,
            user_query=user_query,
            matched_slug=slug,
            scheme_name=scheme_name,
            eligibility_verdict=eval_result["verdict"],
            agent_response=final_answer
        )

        return {
            "success": True,
            "answer": final_answer,
            "verdict": eval_result["verdict"],
            "scheme_matched": {
                "slug": slug,
                "name": scheme_name,
                "short_title": scheme_bundle["short_title"],
                "ministry": scheme_bundle["details"].get("basicDetails", {}).get("nodalMinistryName", {}).get("label", "Government of India")
            },
            "database_info": {
                "db_path": self.db.db_path,
                "table": "schemes",
                "record_id": db_record_id,
                "slug": slug,
                "html_size_kb": html_size_kb
            },
            "files": {
                "db_record_id": db_record_id,
                "db_path": self.db.db_path,
                "total_html_filename": f"{slug}.html",
                "total_html_content": html_content,
                "raw_html_content": raw_html_content
            },
            "alternative_matches": [
                {"slug": m.get("slug"), "name": m.get("en", {}).get("basicDetails", {}).get("schemeName")}
                for m in matches[1:]
            ]
        }
