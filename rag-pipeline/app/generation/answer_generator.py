"""
Answer Generation component strictly grounded in verified government documents.
Formats comprehensive answers covering eligibility, benefits, dates, procedures,
and generates structured source citations with issuing departments and URLs.
Supports iterative regeneration with evaluator feedback, outdated document qualification,
and explicit conflict resolution across different documents.
"""

import json
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from groq import Groq

from app.config.settings import get_settings


class SourceCitation(BaseModel):
    """Source citation referencing an official government document."""

    title: str = Field(description="Official title of the scheme or policy document")
    department: str = Field(description="Issuing government ministry or department")
    url: str = Field(description="Verified official government source URL")
    publication_date: str = Field(description="Publication or last updated date")


class GeneratedResponse(BaseModel):
    """Full structured answer response with verified source citations."""

    query: str
    answer: str
    sources: List[SourceCitation]


class AnswerGenerator:
    """Generates factual, citation-backed answers from retrieved government documents."""

    REFUSAL_MESSAGES: Dict[str, str] = {
        "english": "I don't have sufficient verified information in the available government documents to answer this question.",
        "hindi": "उपलब्ध सरकारी दस्तावेजों में इस प्रश्न का उत्तर देने के लिए पर्याप्त सत्यापित जानकारी उपलब्ध नहीं है।",
        "telugu": "అందుబాటులో ఉన్న ప్రభుత్వ పత్రాలలో ఈ ప్రశ్నకు సమాధానం ఇవ్వడానికి తగినంత ధృవీకరించబడిన సమాచారం లేదు.",
        "tamil": "இந்த கேள்விக்கு பதிலளிக்க கிடைக்கும் அரசு ஆவணங்களில் போதுமான சரிபார்க்கப்பட்ட தகவல்கள் இல்லை.",
        "bengali": "এই প্রশ্নের উত্তর দেওয়ার জন্য উপলব্ধ সরকারি নথিপত্রে পর্যাপ্ত যাচাইকৃত তথ্য নেই।",
        "kannada": "ಲಭ್ಯವಿರುವ ಸರ್ಕಾರಿ ದಾಖಲೆಗಳಲ್ಲಿ ಈ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಲು ಸಾಕಷ್ಟು ಪರಿಶೀಲಿಸಿದ ಮಾಹಿತಿ ಇಲ್ಲ.",
        "malayalam": "ഈ ചോദ്യത്തിന് ഉത്തരം നൽകാൻ ലഭ്യമായ സർക്കാർ രേഖകളിൽ മതിയായ പരിശോധിച്ച വിവരങ്ങൾ ലഭ്യമല്ല.",
        "marathi": "या प्रश्नाचे उत्तर देण्यासाठी उपलब्ध सरकारी कागदपत्रांमध्ये पुरेशी पडताळलेली माहिती उपलब्ध नाही.",
        "gujarati": "આ પ્રશ્નનો જવાબ આપવા માટે ઉપલબ્ધ સરકારી દસ્તાવેજોમાં પૂરતી ચકાસાયેલ માહિતી નથી.",
        "punjabi": "ਇਸ ਸਵਾਲ ਦਾ ਜਵਾਬ ਦੇਣ ਲਈ ਉਪਲਬਧ ਸਰਕਾਰੀ ਦਸਤਾਵੇਜ਼ਾਂ ਵਿੱਚ ਲੋੜੀਂਦੀ ਪ੍ਰਮਾਣਿਤ ਜਾਣਕਾਰੀ ਨਹੀਂ ਹੈ।",
        "odia": "ଏହି ପ୍ରଶ୍ନର ଉତ୍ତର ଦେବା ପାଇଁ ଉପଲବ୍ଧ ସରକାରୀ ଦସ୍ତାବିଜରେ ଯଥେଷ୍ଟ ପ୍ରମାଣିତ ସୂଚନା ନାହିଁ।",
        "urdu": "اس سوال کا جواب دینے کے لیے دستیاب سرکاری دستاویزات میں کافی تصدیق شدہ معلومات نہیں ہیں۔",
        "assamese": "এই প্ৰশ্নৰ উত্তৰ দিবলৈ উপলব্ধ চৰকাৰী নথিপত্ৰত পৰ্যাপ্ত পৰীক্ষিত তথ্য নাই।"
    }

    def __init__(self):
        self.settings = get_settings()
        self.client = Groq(api_key=self.settings.GROQ_API_KEY) if self.settings.GROQ_API_KEY else None

    def get_controlled_refusal(self, language: Optional[str] = "English") -> str:
        """Returns controlled refusal in the user's preferred language."""
        lang_key = (language or "English").lower()
        return self.REFUSAL_MESSAGES.get(lang_key, self.REFUSAL_MESSAGES["english"])

    def generate(
        self,
        query: str,
        retrieved_documents: List[Dict[str, Any]],
        evaluator_feedback: Optional[str] = None,
        response_language: Optional[str] = "English",
        alignment_guidance: Optional[str] = None,
    ) -> GeneratedResponse:
        """
        Generates a verified answer using retrieved documents as the single source of truth.
        Incorporates evaluator feedback when regenerating after faithfulness failures.
        Generates in response_language (Indic or English) while preserving scheme names, amounts, and dates.
        """
        target_lang = response_language or "English"

        if not retrieved_documents:
            return GeneratedResponse(
                query=query,
                answer=self.get_controlled_refusal(target_lang),
                sources=[]
            )

        citations_map: Dict[str, SourceCitation] = {}
        context_blocks = []

        for idx, doc in enumerate(retrieved_documents[:5]):
            meta = doc.get("metadata", {})
            verification = doc.get("source_verification", {})

            title = meta.get("title", f"Document {idx+1}")
            dept = meta.get("department", "Government of India")
            url = meta.get("source_url") or meta.get("url", "https://www.myscheme.gov.in")
            pub_date = str(meta.get("publication_date") or meta.get("last_updated", "2024-01-01"))[:10]
            is_outdated = verification.get("is_outdated", False)
            content = doc.get("page_content", "")

            # Register citation
            if url not in citations_map:
                citations_map[url] = SourceCitation(
                    title=title,
                    department=dept,
                    url=url,
                    publication_date=pub_date
                )

            status_note = " [NOTE: Older policy record; qualify currency]" if is_outdated else ""
            context_blocks.append(
                f"--- SOURCE [{idx+1}]: {title}{status_note} ---\n"
                f"Department/Ministry: {dept}\n"
                f"Publication Date: {pub_date}\n"
                f"Source URL: {url}\n\n"
                f"Content:\n{content}\n"
            )

        citations_list = list(citations_map.values())
        joined_context = "\n\n".join(context_blocks)

        if not self.client:
            return self._heuristic_fallback_answer(query, citations_list, retrieved_documents, target_lang)

        feedback_instruction = ""
        if evaluator_feedback:
            feedback_instruction = (
                f"\nCRITICAL EVALUATOR FEEDBACK FROM PREVIOUS ATTEMPT:\n"
                f"{evaluator_feedback}\n"
                f"You MUST completely omit all unsupported claims and terms mentioned above. "
                f"Do NOT mention, repeat, or refute them in your answer. "
                f"Simply provide the factual answer strictly and exclusively from the context provided below.\n"
            )

        language_instruction = ""
        if target_lang.lower() != "english":
            language_instruction = (
                f"\nCRITICAL MULTILINGUAL INSTRUCTION:\n"
                f"The user has requested the answer in {target_lang}.\n"
                f"You MUST respond completely and naturally in {target_lang}.\n"
                f"STRICT FACTUAL GROUNDING RULES FOR {target_lang.upper()}:\n"
                f"1. Official Scheme Names: Retain official scheme names accurately (e.g. 'PM-KISAN', 'Ayushman Bharat'). You may include the script name in {target_lang} alongside the English name.\n"
                f"2. Monetary Figures & Numbers: Preserve exact amounts without modification (e.g. ₹6,000, 3 installments, ₹2,000 each).\n"
                f"3. Dates & Deadlines: Preserve exact years and dates (e.g. 2024, 2019).\n"
                f"4. Official URLs & Citations: Never translate official URLs (keep exact .gov.in URLs in English).\n"
                f"5. Fluency: Write with clear, formal, and helpful {target_lang} grammar.\n"
            )

        guidance_text = f"\nCROSS-LINGUAL ALIGNMENT:\n{alignment_guidance}\n" if alignment_guidance else ""

        system_prompt = (
            "You are an official Indian Government Information Assistant.\n"
            "Your objective is to provide a comprehensive, accurate, and completely verified answer "
            "based SOLELY on the provided official government sources.\n\n"
            "STRICT RULES:\n"
            "1. Use the provided context as your ONLY source of truth. NEVER invent loan limits, subsidies, dates, or eligibility rules, and do NOT mention schemes not present in the provided sources.\n"
            "2. Structure your response clearly using Markdown:\n"
            "   - **Overview / Objective**\n"
            "   - **Key Benefits & Financial Assistance**\n"
            "   - **Eligibility Criteria**\n"
            "   - **Application Process & Documents Required**\n"
            "3. If a source document is marked as older/outdated, explicitly qualify that the figures reflect earlier policy guidelines.\n"
            "4. If two sources present conflicting numbers or conditions, compare publication dates and issuing authorities explicitly and state the discrepancy rather than blending contradictory numbers.\n"
            "5. Cite the relevant scheme names, issuing departments, and official URLs in your response.\n"
            "6. If certain details requested by the user are not present in the provided context, explicitly state: "
            "\"This specific information is not detailed in the available official records.\"\n"
            f"{language_instruction}"
            f"{guidance_text}"
            f"{feedback_instruction}"
        )

        user_prompt = (
            f"User Query:\n{query}\n\n"
            f"Target Response Language: {target_lang}\n\n"
            f"Verified Official Sources Context:\n{joined_context}\n\n"
            f"Please generate the verified government information response in {target_lang}."
        )

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
                    max_tokens=1500,
                    timeout=12.0
                )
                answer_text = response.choices[0].message.content or ""
                if answer_text.strip():
                    return GeneratedResponse(
                        query=query,
                        answer=answer_text.strip(),
                        sources=citations_list
                    )
            except Exception as e:
                print(f"[AnswerGenerator] Error with model {model}: {e}. Retrying next model...")

        return self._heuristic_fallback_answer(query, citations_list, retrieved_documents, target_lang)

    def _heuristic_fallback_answer(
        self,
        query: str,
        citations: List[SourceCitation],
        retrieved_documents: List[Dict[str, Any]],
        response_language: str = "English"
    ) -> GeneratedResponse:
        """Deterministic fallback synthesis combining all verified context documents."""
        primary_doc = retrieved_documents[0]
        meta = primary_doc.get("metadata", {})
        title = meta.get("title", "Official Government Scheme")
        dept = meta.get("department", "Government of India")

        snippets = []
        for d in retrieved_documents[:4]:
            c = d.get("page_content", "").strip()
            if c:
                snippets.append(c)
        content_preview = "\n\n".join(snippets)

        answer = (
            f"### {title}\n\n"
            f"**Issuing Department**: {dept}\n\n"
            f"Based on the official government documentation retrieved for your inquiry:\n\n"
            f"{content_preview}\n\n"
            f"For detailed guidelines, eligibility, and the application procedure, refer to the official document links cited below."
        )

        return GeneratedResponse(
            query=query,
            answer=answer,
            sources=citations
        )
