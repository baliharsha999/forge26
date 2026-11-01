"""
Nagarik AI - WhatsApp Bot Engine
Core conversational orchestration engine for citizens across WhatsApp.
Provides:
- In-memory conversation state per citizen
- Zero-Knowledge PII shielding
- Audio voice note transcription
- Multilingual reasoning (Telugu, Hindi, English)
- TwiML XML generator
- Meta WhatsApp Cloud API JSON generator
- Direct outbound sender via Meta Graph API or Twilio REST API
"""

import os
import re
import html
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import httpx
from pydantic import BaseModel, Field

from .config import bot_config
from .pii_shield import pii_shield, PIIShieldResult
from .language import language_engine, LanguageDetectionResult
from .audio_transcriber import audio_transcriber, AudioTranscriptionResult
from .rag_router import civic_router, CivicQueryResult, SchemeCitationItem

logger = logging.getLogger("nagarik_ai.whatsapp_bot")


class BotProcessResult(BaseModel):
    status: str = "success"
    from_number_display: str
    original_input: str
    sanitized_input: str
    is_voice_note: bool = False
    voice_transcription_provider: Optional[str] = None
    resolved_query: str
    language: str
    detected_language: str
    whatsapp_message: str
    raw_markdown: str
    has_pii_detected: bool = False
    pii_types_detected: List[str] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    suggested_replies: List[Dict[str, str]] = Field(default_factory=list)
    twiml: str
    meta_payload: Dict[str, Any]
    timestamp: str


class WhatsAppBotEngine:
    """
    Production-grade WhatsApp Bot Engine for Nagarik AI.
    """

    def __init__(self):
        # In-memory session store: phone_key -> session dict
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def get_or_create_session(self, phone: str) -> Dict[str, Any]:
        """Retrieves or creates user session, masking phone number in memory."""
        clean_key = re.sub(r"[^\d+]", "", phone)
        now_iso = datetime.now(timezone.utc).isoformat()
        if clean_key not in self.sessions:
            self.sessions[clean_key] = {
                "phone_masked": pii_shield.sanitize_phone_display(clean_key),
                "language": bot_config.DEFAULT_LANGUAGE,
                "message_count": 0,
                "created_at": now_iso,
                "last_active": now_iso,
                "last_topic": None,
                "history": []
            }
        self.sessions[clean_key]["last_active"] = now_iso
        return self.sessions[clean_key]

    def format_whatsapp_text(
        self,
        raw_text: str,
        citations: List[SchemeCitationItem],
        language: str = "en",
        privacy_notice: Optional[str] = None
    ) -> str:
        """
        Formats text specifically for WhatsApp readability:
        - Bold headers with civic emojis
        - Clean bullet points
        - Verified .gov.in sources block
        - Quick action menu
        """
        text = raw_text.strip()

        # Transform markdown headers
        text = re.sub(r"^###\s+(.+)$", r"🏛️ *\1*", text, flags=re.MULTILINE)
        text = re.sub(r"^##\s+(.+)$", r"📌 *\1*", text, flags=re.MULTILINE)
        text = re.sub(r"^#\s+(.+)$", r"🇮🇳 *\1*", text, flags=re.MULTILINE)

        # Markdown **bold** -> *bold*
        text = re.sub(r"\*\*([^*]+)\*\*", r"*\1*", text)

        # Markdown links [Text](URL) -> *Text*: URL
        text = re.sub(r"\[([^\]]+)\]\((https?://[^\)]+)\)", r"*\1*: \2", text)

        # Clean bullets
        text = re.sub(r"^\s*-\s+", r"• ", text, flags=re.MULTILINE)

        # Citations block
        citations_block = ""
        if citations:
            if language == "hi":
                citations_block = "\n\n🌐 *सत्यापित आधिकारिक पोर्टल (Official Sources):*"
            elif language == "te":
                citations_block = "\n\n🌐 *ధృవీకరించబడిన అధికారిక పోర్టల్స్ (Official Sources):*"
            else:
                citations_block = "\n\n🌐 *Verified Official Sources & Portals:*"

            for c in citations[:3]:
                url = c.official_url or "https://myscheme.gov.in"
                citations_block += f"\n• *{c.name}*: {url}"

        # Menu block
        if language == "hi":
            menu_block = (
                "\n\n────────────────────\n"
                "⚡ *त्वरित विकल्प (नंबर लिखकर उत्तर दें):*\n"
                "1️⃣ आधार डीबीटी स्थिति (Bank Seeding)\n"
                "2️⃣ पीएम-किसान योजना (PM-KISAN)\n"
                "3️⃣ नागरिक समस्या दर्ज करें (Grievance)\n"
                "4️⃣ आयुष्मान भारत स्वास्थ्य (₹5 Lakh)\n"
                "5️⃣ भाषा बदलें (Reply: EN / हिंदी / తెలుగు)"
            )
        elif language == "te":
            menu_block = (
                "\n\n────────────────────\n"
                "⚡ *త్వరిత ఎంపికలు (నంబర్‌తో సమాధానం ఇవ్వండి):*\n"
                "1️⃣ ఆధార్ DBT సీడింగ్ స్టేటస్\n"
                "2️⃣ PM-కిసాన్ పథకం ప్రయోజనాలు\n"
                "3️⃣ పౌర సమస్యపై ఫిర్యాదు (Grievance)\n"
                "4️⃣ ఆయుష్మాన్ భారత్ హెల్త్ కవరేజ్ (₹5L)\n"
                "5️⃣ భాష మార్చుకోండి (Reply: EN / हिंदी / తెలుగు)"
            )
        else:
            menu_block = (
                "\n\n────────────────────\n"
                "⚡ *Quick Menu (Reply with number):*\n"
                "1️⃣ Check Aadhaar DBT Seeding Status\n"
                "2️⃣ PM-KISAN Scheme & Subsidy\n"
                "3️⃣ File Civic Grievance (CPGRAMS)\n"
                "4️⃣ Ayushman Bharat PM-JAY (₹5 Lakh)\n"
                "5️⃣ Switch Language (Reply: EN / हिंदी / తెలుగు)"
            )

        privacy_block = f"\n\n{privacy_notice}" if privacy_notice else ""
        return f"{privacy_block}\n\n{text}{citations_block}{menu_block}".strip()

    def generate_twiml(self, message_body: str) -> str:
        """Generates TwiML XML response for Twilio WhatsApp Webhook."""
        escaped = html.escape(message_body)
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Response>\n'
            f'    <Message>\n        <Body>{escaped}</Body>\n    </Message>\n'
            '</Response>'
        )

    def generate_meta_payload(
        self,
        to_number: str,
        message_body: str,
        quick_replies: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Generates Meta WhatsApp Cloud API compliant JSON payload."""
        clean_to = re.sub(r"[^\d]", "", to_number)
        replies = quick_replies or language_engine.get_quick_replies("en")

        interactive_buttons = []
        for r in replies[:3]:
            btn_id = f"btn_{r['id']}"
            btn_title = r["label"][:20]
            interactive_buttons.append({
                "type": "reply",
                "reply": {
                    "id": btn_id,
                    "title": btn_title
                }
            })

        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "header": {
                    "type": "text",
                    "text": "🏛️ Nagarik AI - Civic Copilot"
                },
                "body": {
                    "text": message_body[:1024]
                },
                "footer": {
                    "text": "Grounded in Official Indian .gov.in Portals"
                },
                "action": {
                    "buttons": interactive_buttons
                }
            }
        }

    async def send_meta_cloud_message(self, to_number: str, text: str) -> bool:
        """Sends outbound WhatsApp message using Meta Graph API if access token is configured."""
        if not (bot_config.WHATSAPP_ACCESS_TOKEN and bot_config.WHATSAPP_PHONE_NUMBER_ID):
            return False

        url = f"https://graph.facebook.com/{bot_config.META_GRAPH_VERSION}/{bot_config.WHATSAPP_PHONE_NUMBER_ID}/messages"
        clean_to = re.sub(r"[^\d]", "", to_number)
        headers = {
            "Authorization": f"Bearer {bot_config.WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_to,
            "type": "text",
            "text": {"preview_url": True, "body": text}
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                return res.status_code in (200, 201)
        except Exception as e:
            logger.error(f"Error sending Meta Cloud message: {e}")
            return False

    async def process_message(
        self,
        from_number: str,
        message_text: Optional[str] = None,
        media_type: Optional[str] = None,
        media_url: Optional[str] = None,
        media_bytes: Optional[bytes] = None,
        forced_language: Optional[str] = None
    ) -> BotProcessResult:
        """
        Main inbound message processing pipeline.
        1. Sanitize incoming text with Zero-Knowledge PII Shield.
        2. Process audio voice note if present.
        3. Detect language (Telugu, Hindi, English).
        4. Resolve shortcuts / greetings / queries.
        5. Query CivicSchemeRouter.
        6. Return WhatsApp formatted text, TwiML, and Meta Cloud JSON.
        """
        session = self.get_or_create_session(from_number)
        session["message_count"] += 1

        raw_input = (message_text or "").strip()
        is_voice = bool(media_type and "audio" in media_type.lower()) or bool(media_bytes)
        voice_provider = None

        # ---------------------------------------------------------------------
        # 1. Voice Note Processing (Multimodal Audio)
        # ---------------------------------------------------------------------
        if is_voice:
            trans_res = await audio_transcriber.process_voice_note(
                media_url=media_url,
                media_bytes=media_bytes,
                auth_type="twilio" if "twilio" in (media_url or "").lower() else "meta"
            )
            raw_input = trans_res.transcribed_text
            voice_provider = trans_res.provider

        # ---------------------------------------------------------------------
        # 2. Zero-Knowledge PII Shielding
        # ---------------------------------------------------------------------
        pii_res = pii_shield.sanitize(raw_input)
        sanitized_input = pii_res.sanitized_text

        # ---------------------------------------------------------------------
        # 3. Language Detection & Selection
        # ---------------------------------------------------------------------
        lower_input = sanitized_input.lower().strip()
        if forced_language:
            session["language"] = forced_language
            current_lang = forced_language
        else:
            current_lang = session.get("language", bot_config.DEFAULT_LANGUAGE)

        # Explicit language change triggers (avoiding collision with greeting "hi")
        if lower_input in ("telugu", "తెలుగు", "change language te", "lang te"):
            session["language"] = "te"
            current_lang = "te"
            welcome = language_engine.get_welcome_message("te")
            formatted = self.format_whatsapp_text(welcome, [], "te")
            return BotProcessResult(
                from_number_display=session["phone_masked"],
                original_input=raw_input,
                sanitized_input=sanitized_input,
                is_voice_note=is_voice,
                voice_transcription_provider=voice_provider,
                resolved_query=sanitized_input,
                language="te",
                detected_language="Telugu",
                whatsapp_message=formatted,
                raw_markdown=welcome,
                citations=[],
                suggested_replies=language_engine.get_quick_replies("te"),
                twiml=self.generate_twiml(formatted),
                meta_payload=self.generate_meta_payload(from_number, formatted, language_engine.get_quick_replies("te")),
                timestamp=datetime.now(timezone.utc).isoformat()
            )
        elif lower_input in ("hindi", "हिंदी", "change language hi", "lang hi"):
            session["language"] = "hi"
            current_lang = "hi"
            welcome = language_engine.get_welcome_message("hi")
            formatted = self.format_whatsapp_text(welcome, [], "hi")
            return BotProcessResult(
                from_number_display=session["phone_masked"],
                original_input=raw_input,
                sanitized_input=sanitized_input,
                is_voice_note=is_voice,
                voice_transcription_provider=voice_provider,
                resolved_query=sanitized_input,
                language="hi",
                detected_language="Hindi",
                whatsapp_message=formatted,
                raw_markdown=welcome,
                citations=[],
                suggested_replies=language_engine.get_quick_replies("hi"),
                twiml=self.generate_twiml(formatted),
                meta_payload=self.generate_meta_payload(from_number, formatted, language_engine.get_quick_replies("hi")),
                timestamp=datetime.now(timezone.utc).isoformat()
            )
        elif lower_input in ("english", "change language en", "lang en"):
            session["language"] = "en"
            current_lang = "en"

        # Automatic detection if no language override was forced
        if not forced_language:
            det = language_engine.detect_language(sanitized_input, default_lang=current_lang)
            if det.confidence >= 0.8:
                current_lang = det.code
                session["language"] = current_lang

        # ---------------------------------------------------------------------
        # 4. Handle Shortcuts & Greetings
        # ---------------------------------------------------------------------
        resolved_query = sanitized_input
        if lower_input in ("1", "1.", "btn_1", "dbt", "check dbt", "aadhaar dbt"):
            resolved_query = "How to check Aadhaar DBT bank account seeding status on NPCI mapper?"
        elif lower_input in ("2", "2.", "btn_2", "pm kisan", "pm-kisan", "pmkisan"):
            resolved_query = "What are PM-KISAN eligibility criteria, installment details, and application steps?"
        elif lower_input in ("3", "3.", "btn_3", "grievance", "complaint", "cpgrams"):
            resolved_query = "How to file a civic grievance on CPGRAMS or municipal portal?"
        elif lower_input in ("4", "4.", "btn_4", "ayushman", "pmjay", "health card"):
            resolved_query = "How to get Ayushman Bharat PM-JAY ₹5 Lakh cashless health cover?"
        elif lower_input in ("hi", "hello", "hey", "namaste", "help", "start", "menu", "నమస్కారం", "హలో"):
            welcome = language_engine.get_welcome_message(current_lang)
            formatted = self.format_whatsapp_text(welcome, [], current_lang)
            return BotProcessResult(
                from_number_display=session["phone_masked"],
                original_input=raw_input,
                sanitized_input=sanitized_input,
                is_voice_note=is_voice,
                voice_transcription_provider=voice_provider,
                resolved_query=sanitized_input,
                language=current_lang,
                detected_language="Telugu" if current_lang == "te" else ("Hindi" if current_lang == "hi" else "English"),
                whatsapp_message=formatted,
                raw_markdown=welcome,
                citations=[],
                suggested_replies=language_engine.get_quick_replies(current_lang),
                twiml=self.generate_twiml(formatted),
                meta_payload=self.generate_meta_payload(from_number, formatted, language_engine.get_quick_replies(current_lang)),
                timestamp=datetime.now(timezone.utc).isoformat()
            )

        # ---------------------------------------------------------------------
        # 5. Route Query to CivicSchemeRouter (Supabase / RAG / KB)
        # ---------------------------------------------------------------------
        voice_badge = "🎙️ _[Voice Note Processed via Nagarik Speech Intelligence]_\n\n" if is_voice else ""
        privacy_notice = None
        if pii_res.has_pii:
            if current_lang == "hi":
                privacy_notice = pii_res.privacy_notice_hi
            elif current_lang == "te":
                privacy_notice = pii_res.privacy_notice_te
            else:
                privacy_notice = pii_res.privacy_notice_en

        civic_res = await civic_router.route_query(resolved_query, lang=current_lang)
        final_answer = f"{voice_badge}{civic_res.answer}"

        formatted_message = self.format_whatsapp_text(
            raw_text=final_answer,
            citations=civic_res.citations,
            language=current_lang,
            privacy_notice=privacy_notice
        )

        quick_replies = language_engine.get_quick_replies(current_lang)
        twiml_output = self.generate_twiml(formatted_message)
        meta_output = self.generate_meta_payload(from_number, formatted_message, quick_replies)

        return BotProcessResult(
            status="success",
            from_number_display=session["phone_masked"],
            original_input=raw_input,
            sanitized_input=sanitized_input,
            is_voice_note=is_voice,
            voice_transcription_provider=voice_provider,
            resolved_query=resolved_query,
            language=current_lang,
            detected_language="Telugu" if current_lang == "te" else ("Hindi" if current_lang == "hi" else "English"),
            whatsapp_message=formatted_message,
            raw_markdown=civic_res.answer,
            has_pii_detected=pii_res.has_pii,
            pii_types_detected=pii_res.detected_pii_types,
            citations=[c.model_dump() for c in civic_res.citations],
            suggested_replies=quick_replies,
            twiml=twiml_output,
            meta_payload=meta_output,
            timestamp=datetime.now(timezone.utc).isoformat()
        )


bot_engine = WhatsAppBotEngine()
