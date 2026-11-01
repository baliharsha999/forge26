"""
Nagarik AI - WhatsApp Bot Service Test Suite
Comprehensive unit and integration tests covering:
1. Zero-Knowledge PII Shielding (Aadhaar, Phone, PAN, Voter ID)
2. Multilingual Language Detection (Telugu, Hindi, English, Hinglish, Tenglish)
3. Audio Transcriber (Voice Notes)
4. Civic Scheme RAG Router & .gov.in Citations
5. Bot Engine State & Response Formatter (TwiML & Meta JSON)
6. Webhook Handlers (Meta verification, Twilio form webhook, Meta JSON webhook, Simulator)
"""

import asyncio
import xml.etree.ElementTree as ET
from fastapi.testclient import TestClient

from backend.whatsapp_bot.config import bot_config
from backend.whatsapp_bot.pii_shield import pii_shield, PIIShield
from backend.whatsapp_bot.language import language_engine, LanguageEngine
from backend.whatsapp_bot.audio_transcriber import audio_transcriber, VoiceNoteTranscriber
from backend.whatsapp_bot.rag_router import civic_router, CivicSchemeRouter
from backend.whatsapp_bot.bot_engine import bot_engine, WhatsAppBotEngine
from backend.whatsapp_bot.main import app

client = TestClient(app)


# =============================================================================
# 1. Zero-Knowledge PII Shielding Tests
# =============================================================================
class TestPIIShield:

    def test_aadhaar_masking(self):
        # Test spaced format
        text1 = "My Aadhaar is 5432 9876 1234 please register me"
        res1 = pii_shield.sanitize(text1)
        assert res1.has_pii is True
        assert "Aadhaar Number (UIDAI)" in res1.detected_pii_types
        assert "XXXX-XXXX-1234" in res1.sanitized_text
        assert "5432 9876 1234" not in res1.sanitized_text

        # Test hyphenated format
        text2 = "Aadhaar: 2345-6789-0123"
        res2 = pii_shield.sanitize(text2)
        assert "XXXX-XXXX-0123" in res2.sanitized_text

    def test_pan_masking(self):
        text = "My PAN card is ABCDE1234F"
        res = pii_shield.sanitize(text)
        assert res.has_pii is True
        assert "Income Tax PAN" in res.detected_pii_types
        assert "ABXXXXX" in res.sanitized_text
        assert "ABCDE1234F" not in res.sanitized_text

    def test_phone_masking(self):
        text = "Contact me at 9876543210 for scheme updates"
        res = pii_shield.sanitize(text)
        assert res.has_pii is True
        assert "Citizen Phone Number" in res.detected_pii_types
        assert "+91-XXXXX-XX210" in res.sanitized_text
        assert "9876543210" not in res.sanitized_text

    def test_voter_id_masking(self):
        text = "My EPIC number is WBD1234567"
        res = pii_shield.sanitize(text)
        assert res.has_pii is True
        assert "Election EPIC Voter ID" in res.detected_pii_types
        assert "WBDXXXX567" in res.sanitized_text

    def test_multilingual_privacy_notices(self):
        text = "Aadhaar 5432 9876 1234"
        res = pii_shield.sanitize(text)
        assert "Zero-Knowledge Privacy Shield" in res.privacy_notice_en
        assert "गोपनीयता सुरक्षा" in res.privacy_notice_hi
        assert "జీరో-నాలెడ్జ్" in res.privacy_notice_te


# =============================================================================
# 2. Multilingual Language Engine Tests
# =============================================================================
class TestLanguageEngine:

    def test_telugu_script_detection(self):
        text = "నమస్కారం, నాకు పిఎం-కిసాన్ పథకం సహాయం కావాలి"
        det = language_engine.detect_language(text)
        assert det.code == "te"
        assert det.name == "Telugu"
        assert det.confidence >= 0.8

    def test_hindi_script_detection(self):
        text = "नमस्ते, मुझे आयुष्मान भारत योजना में नाम जोड़ना है"
        det = language_engine.detect_language(text)
        assert det.code == "hi"
        assert det.name == "Hindi"
        assert det.confidence >= 0.8

    def test_english_detection(self):
        text = "How do I check my Aadhaar DBT bank account seeding?"
        det = language_engine.detect_language(text)
        assert det.code == "en"
        assert det.name == "English"

    def test_hinglish_detection(self):
        text = "kisan yojana ka paisa kab aayega"
        det = language_engine.detect_language(text)
        assert det.code == "hi"

    def test_tenglish_detection(self):
        text = "rythu kisan pathakam eppudu vasthundi"
        det = language_engine.detect_language(text)
        assert det.code == "te"


# =============================================================================
# 3. Audio Transcriber Tests
# =============================================================================
class TestAudioTranscriber:

    def test_fallback_transcription(self):
        dummy_audio = b"FAKE_OGG_AUDIO_HEADER_DATA_123456"
        res = asyncio.run(audio_transcriber.transcribe_audio_bytes(dummy_audio))
        assert res.success is True
        assert len(res.transcribed_text) > 0

    def test_process_voice_note_without_media(self):
        res = asyncio.run(audio_transcriber.process_voice_note(media_url=None))
        assert res.success is True
        assert "Aadhaar" in res.transcribed_text or "DBT" in res.transcribed_text


# =============================================================================
# 4. Civic Scheme Router & Grounding Tests
# =============================================================================
class TestCivicSchemeRouter:

    def test_pm_kisan_routing(self):
        res = asyncio.run(civic_router.route_query("PM-KISAN eligibility and installment", lang="en"))
        assert "PM-KISAN" in res.answer or "Kisan" in res.answer
        assert len(res.citations) > 0
        assert any("pmkisan.gov.in" in c.official_url for c in res.citations)

    def test_ayushman_bharat_routing(self):
        res = asyncio.run(civic_router.route_query("Ayushman Bharat 5 lakh hospital", lang="en"))
        assert "Ayushman" in res.answer or "5,00,000" in res.answer
        assert len(res.citations) > 0
        assert any("nha.gov.in" in c.official_url for c in res.citations)

    def test_telugu_query_routing(self):
        res = asyncio.run(civic_router.route_query("పిఎం కిసాన్ అర్హతలు", lang="te"))
        assert res.language == "te"
        assert "కిసాన్" in res.answer or "PM" in res.answer


# =============================================================================
# 5. WhatsApp Bot Engine Tests
# =============================================================================
class TestWhatsAppBotEngine:

    def test_welcome_greeting(self):
        res = asyncio.run(bot_engine.process_message(
            from_number="+919999900001",
            message_text="Hi",
            forced_language="en"
        ))
        assert res.status == "success"
        assert "Welcome to Nagarik AI" in res.whatsapp_message
        assert len(res.suggested_replies) >= 3
        assert "<Response>" in res.twiml

    def test_shortcut_selection(self):
        res = asyncio.run(bot_engine.process_message(
            from_number="+919999900002",
            message_text="1",
            forced_language="en"
        ))
        assert "DBT" in res.resolved_query or "Aadhaar" in res.resolved_query
        assert "myaadhaar.uidai.gov.in" in res.whatsapp_message or "DBT" in res.whatsapp_message

    def test_pii_auto_mask_in_engine(self):
        res = asyncio.run(bot_engine.process_message(
            from_number="+919999900003",
            message_text="Check my pension for Aadhaar 3456 7890 1234 and mobile 9876543210",
            forced_language="en"
        ))
        assert res.has_pii_detected is True
        assert "XXXX-XXXX-1234" in res.sanitized_input
        assert "3456 7890 1234" not in res.sanitized_input
        assert "Zero-Knowledge Privacy Shield" in res.whatsapp_message

    def test_voice_note_processing(self):
        res = asyncio.run(bot_engine.process_message(
            from_number="+919999900004",
            media_type="audio/ogg",
            media_bytes=b"OGG_HEADER_DATA_MOCK",
            forced_language="en"
        ))
        assert res.is_voice_note is True
        assert "Voice Note Processed" in res.whatsapp_message


# =============================================================================
# 6. Webhook Endpoints HTTP Tests
# =============================================================================
class TestWebhookEndpoints:

    def test_meta_webhook_verification_success(self):
        challenge = "random_challenge_998811"
        response = client.get(
            "/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": bot_config.WHATSAPP_VERIFY_TOKEN,
                "hub.challenge": challenge
            }
        )
        assert response.status_code == 200
        assert response.text == challenge

    def test_meta_webhook_verification_failure(self):
        response = client.get(
            "/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong_token",
                "hub.challenge": "123"
            }
        )
        assert response.status_code == 403

    def test_twilio_inbound_webhook(self):
        response = client.post(
            "/webhook",
            data={
                "From": "whatsapp:+919876543210",
                "Body": "How to check Aadhaar DBT status?",
                "NumMedia": "0"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 200
        assert "application/xml" in response.headers["content-type"]
        # Verify valid XML
        root = ET.fromstring(response.text)
        assert root.tag == "Response"
        assert root.find("Message") is not None

    def test_meta_inbound_json_webhook(self):
        meta_payload = {
            "object": "whatsapp_business_account",
            "entry": [{
                "id": "10001",
                "changes": [{
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {"phone_number_id": "12345"},
                        "messages": [{
                            "from": "919876543210",
                            "id": "wamid.HBgL",
                            "timestamp": "1730460000",
                            "text": {"body": "PM-KISAN eligibility criteria"},
                            "type": "text"
                        }]
                    },
                    "field": "messages"
                }]
            }]
        }
        response = client.post("/webhook", json=meta_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "delivered"
        assert "result" in data

    def test_simulation_endpoint(self):
        payload = {
            "from_number": "+919876543210",
            "message": "Aadhaar 5678 1234 9012 how to check DBT seeding?",
            "language": "en"
        }
        response = client.post("/simulate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["has_pii_detected"] is True
        assert "XXXX-XXXX-9012" in data["sanitized_input"]
        assert len(data["citations"]) > 0
        assert "<Response>" in data["twiml"]
        assert "interactive" in data["meta_payload"]

    def test_health_check(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["zero_knowledge_pii_shield"]["mask_aadhaar"] is True
