"""
Nagarik AI - WhatsApp Multilingual Language Engine
Detects: Telugu, Hindi, English, and Romanized Dialects (Hinglish, Tenglish).
Provides multilingual templates for WhatsApp bubbles and quick menus.
"""

import re
import unicodedata
from typing import Dict, Any, List, Tuple
from pydantic import BaseModel

# Unicode script ranges
TELUGU_SCRIPT_REGEX = re.compile(r'[\u0C00-\u0C7F]')
DEVANAGARI_SCRIPT_REGEX = re.compile(r'[\u0900-\u097F]')

# Common Romanized Hindi words (Hinglish)
HINGLISH_KEYWORDS = {
    "kya", "kaise", "yojana", "shikayat", "aadhar", "sarkar", "nahi", "mujhe", 
    "paisa", "paise", "khata", "namaste", "dhanyawad", "madad", "suchi", "kisan",
    "ration", "ayushman", "pension", "bhejo", "batao", "kab", "aayega", "milta"
}

# Common Romanized Telugu words (Tenglish)
TENGLISH_KEYWORDS = {
    "ela", "pathakam", "yavaru", "darakhasthu", "cheyali", "raaledu", "naku",
    "namaskaram", "dhanyavadamulu", "sahayam", "yojana", "rythu", "kisan",
    "ration", "aarogyasri", "pension", "eppudu", "vasthundi", "ivvandi", "chudali"
}


class LanguageDetectionResult(BaseModel):
    code: str  # "en", "hi", "te"
    name: str  # "English", "Hindi", "Telugu"
    confidence: float
    is_script_match: bool


class LanguageEngine:
    """
    Intelligent language detector and localized response generator for WhatsApp citizens.
    """

    @classmethod
    def detect_language(cls, text: str, default_lang: str = "en") -> LanguageDetectionResult:
        """
        Detects language from text using Unicode script analysis followed by phonetic dictionary lookup.
        """
        if not text or not text.strip():
            return LanguageDetectionResult(code=default_lang, name="English", confidence=1.0, is_script_match=False)

        clean_text = unicodedata.normalize("NFC", text.strip())
        lower_text = clean_text.lower()

        # 1. Direct Script Checks (High Confidence)
        telugu_chars = len(TELUGU_SCRIPT_REGEX.findall(clean_text))
        devanagari_chars = len(DEVANAGARI_SCRIPT_REGEX.findall(clean_text))
        total_indic = telugu_chars + devanagari_chars

        if telugu_chars > 0 and telugu_chars >= devanagari_chars:
            confidence = min(1.0, 0.7 + (telugu_chars / max(len(clean_text), 1)) * 0.3)
            return LanguageDetectionResult(code="te", name="Telugu", confidence=round(confidence, 2), is_script_match=True)

        if devanagari_chars > 0:
            confidence = min(1.0, 0.7 + (devanagari_chars / max(len(clean_text), 1)) * 0.3)
            return LanguageDetectionResult(code="hi", name="Hindi", confidence=round(confidence, 2), is_script_match=True)

        # 2. Romanized Words Analysis (Hinglish / Tenglish)
        words = re.findall(r'\b[a-z]{3,}\b', lower_text)
        if words:
            word_set = set(words)
            te_hits = len(word_set.intersection(TENGLISH_KEYWORDS))
            hi_hits = len(word_set.intersection(HINGLISH_KEYWORDS))

            if te_hits > hi_hits and te_hits >= 1:
                return LanguageDetectionResult(code="te", name="Telugu (Romanized)", confidence=0.85, is_script_match=False)
            if hi_hits > te_hits and hi_hits >= 1:
                return LanguageDetectionResult(code="hi", name="Hindi (Romanized)", confidence=0.85, is_script_match=False)

        # 3. Default to English
        return LanguageDetectionResult(code="en", name="English", confidence=0.95, is_script_match=False)

    @classmethod
    def get_welcome_message(cls, lang: str = "en") -> str:
        if lang == "hi":
            return (
                "🏛️ *नागरिक AI (Nagarik AI) — आपका आधिकारिक व्हाट्सएप जन-सहायक*\n"
                "_(सत्यापित सरकारी योजनाएं • प्रत्यक्ष लाभ अंतरण DBT • नागरिक शिकायत निवारण)_\n\n"
                "मैं आपकी सहायता कर सकता हूँ:\n"
                "• *आधार DBT बैंक सीडिंग जांच* (NPCI स्थिति)\n"
                "• *5,210+ सत्यापित कल्याणकारी योजनाएं* (PM-किसान, PMAY, मुद्रा, छात्रवृत्ति)\n"
                "• *नागरिक शिकायत समाधान* (सड़क, जल, स्वच्छता, बिजली CPGRAMS)\n"
                "• *पहचान पत्र लोकेटर* (APAAR छात्र ID, UAN, वोटर कार्ड)\n\n"
                "👉 *अपना प्रश्न सीधे हिंदी, తెలుగు లేదా English లో పంపండి, లేదా దిగువ ఎంపికను ఎంచుకోండి:*"
            )
        elif lang == "te":
            return (
                "🏛️ *నాగరిక్ AI (Nagarik AI) — మీ అధికారిక వాట్సాప్ పౌర సహాయకుడు*\n"
                "_(ధృవీకరించబడిన ప్రభుత్వ పథకాలు • ప్రత్యక్ష నగదు బదిలీ DBT • పౌర సమస్యల పరిష్కారం)_\n\n"
                "నేను మీకు సహాయం చేయగలను:\n"
                "• *ఆధార్ DBT బ్యాంక్ సీడింగ్ తనిఖీ* (NPCI స్టేటస్)\n"
                "• *5,210+ ధృవీకరించబడిన సంక్షేమ పథకాలు* (PM-కిసాన్, PMAY, ముద్రా, స్కాలర్‌షిప్స్)\n"
                "• *పౌర సమస్యలపై ఫిర్యాదులు* (రోడ్లు, నీరు, పారిశుధ్యం, విద్యుత్ CPGRAMS)\n"
                "• *గుర్తింపు కార్డుల సమాచారం* (APAAR ID, UAN, ఓటర్ కార్డ్)\n\n"
                "👉 *మీ ప్రశ్నను తెలుగు, हिंदी లేదా English లో నేరుగా అడగండి:*"
            )
        else:
            return (
                "🏛️ *Welcome to Nagarik AI — WhatsApp Civic Copilot*\n"
                "_(Empowering Every Citizen • Sovereign Public Intelligence • Official .gov.in Grounded)_\n\n"
                "I can assist you with:\n"
                "• *Bank DBT Seeding Status* (NPCI Aadhaar Mapper)\n"
                "• *5,210+ Verified Welfare Schemes* (PM-KISAN, PMAY, Mudra, Scholarships)\n"
                "• *Civic Grievance Redressal* (Roads, sanitation, water, electricity CPGRAMS)\n"
                "• *Document & ID Locators* (APAAR ID, UAN, Voter EPIC)\n\n"
                "👉 *Send any question directly in English, Hindi (हिंदी), or Telugu (తెలుగు), or select an option below:*"
            )

    @classmethod
    def get_quick_replies(cls, lang: str = "en") -> List[Dict[str, str]]:
        if lang == "hi":
            return [
                {"id": "1", "label": "1. आधार DBT जांचें", "query": "आधार डीबीटी बैंक खाता सीडिंग स्थिति कैसे जांचें?"},
                {"id": "2", "label": "2. पीएम-किसान योजना", "query": "पीएम-किसान योजना पात्रता और लाभ क्या हैं?"},
                {"id": "3", "label": "3. नागरिक शिकायत दर्ज", "query": "नागरिक समस्या की शिकायत CPGRAMS या नगर पालिका में कैसे दर्ज करें?"},
                {"id": "4", "label": "4. आयुष्मान भारत ₹5L", "query": "आयुष्मान भारत योजना में ₹5 लाख का मुफ्त इलाज कैसे प्राप्त करें?"}
            ]
        elif lang == "te":
            return [
                {"id": "1", "label": "1. ఆధార్ DBT స్టేటస్", "query": "బ్యాంక్ ఖాతా ఆధార్ DBT సీడింగ్ స్టేటస్ ఎలా తనిఖీ చేయాలి?"},
                {"id": "2", "label": "2. PM-కిసాన్ పథకం", "query": "PM-కిసాన్ పథకం అర్హతలు మరియు ₹6000 సహాయం వివరాలు ఏమిటి?"},
                {"id": "3", "label": "3. పౌర సమస్యపై ఫిర్యాదు", "query": "పౌర సమస్యపై మున్సిపల్ లేదా CPGRAMS పోర్టల్‌లో ఫిర్యాదు ఎలా చేయాలి?"},
                {"id": "4", "label": "4. ఆయుష్మాన్ భారత్ ₹5L", "query": "ఆయుష్మాన్ భారత్ హెల్త్ కార్డు ద్వారా ₹5 లక్షల ఉచిత వైద్యం ఎలా పొందాలి?"}
            ]
        else:
            return [
                {"id": "1", "label": "1. Check DBT Seeding", "query": "How to check if bank account is Aadhaar DBT seeded on NPCI?"},
                {"id": "2", "label": "2. PM-KISAN Scheme", "query": "What are PM-KISAN eligibility criteria, installment details, and application steps?"},
                {"id": "3", "label": "3. File Civic Grievance", "query": "How do I file a civic complaint on CPGRAMS or local municipal portal?"},
                {"id": "4", "label": "4. Ayushman Bharat ₹5L", "query": "How to get Ayushman Bharat PM-JAY ₹5 Lakh cashless health cover?"}
            ]


language_engine = LanguageEngine()
