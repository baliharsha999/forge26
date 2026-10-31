"""
Nagarik AI - Automated Test Suite for WhatsApp Citizen Gateway
Tests:
- GET webhook status and Meta verification challenge (hub.verify_token)
- POST webhook Twilio form-encoded TwiML generation
- POST webhook Meta Cloud API JSON delivery
- POST simulate endpoint for English civic questions
- Aadhaar DBT status check via WhatsApp
- Multilingual handling for Telugu and Hindi
- Voice note and image multimodal input handling
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings


@pytest.fixture
def client():
    return TestClient(app)


def test_whatsapp_webhook_status_ping(client):
    """Verifies that the WhatsApp webhook endpoint responds to standard health check."""
    response = client.get("/api/v1/whatsapp/webhook")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert "Nagarik AI" in data["service"]
    assert "Twilio" in data["supported_providers"][0]


def test_meta_webhook_verification_challenge_success(client):
    """Verifies Meta Cloud API challenge-response when token matches."""
    challenge_code = "889977665544"
    response = client.get(
        "/api/v1/whatsapp/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": settings.WHATSAPP_VERIFY_TOKEN,
            "hub.challenge": challenge_code
        }
    )
    assert response.status_code == 200
    assert response.text == challenge_code


def test_meta_webhook_verification_challenge_forbidden(client):
    """Verifies 403 Forbidden when verify_token is invalid."""
    response = client.get(
        "/api/v1/whatsapp/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "incorrect_hacker_token",
            "hub.challenge": "123456"
        }
    )
    assert response.status_code == 403
    assert "verification failed" in response.json()["detail"].lower()


def test_twilio_form_encoded_inbound_webhook(client):
    """Verifies Twilio form-encoded POST webhook returning valid XML TwiML."""
    payload = {
        "From": "whatsapp:+919876543210",
        "To": "whatsapp:+14155238886",
        "Body": "Hello",
        "NumMedia": "0"
    }
    response = client.post(
        "/api/v1/whatsapp/webhook",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")
    assert "<Response>" in response.text
    assert "<Message>" in response.text
    assert "Nagarik AI" in response.text


def test_meta_cloud_api_json_inbound_webhook(client):
    """Verifies Meta Cloud API JSON structure parsing and delivery response."""
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "919876543210",
                        "type": "text",
                        "text": {"body": "How do I check DBT status?"}
                    }]
                }
            }]
        }]
    }
    response = client.post(
        "/api/v1/whatsapp/webhook",
        json=payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "delivered"
    assert "result" in data
    assert data["result"]["status"] == "success"
    assert "myaadhaar.uidai.gov.in" in data["result"]["whatsapp_message"] or "DBT" in data["result"]["whatsapp_message"]


def test_whatsapp_simulate_dbt_query(client):
    """Verifies simulation endpoint for Aadhaar DBT bank account seeding query."""
    payload = {
        "from_number": "+919876543210",
        "message": "How do I check if my bank account is Aadhaar DBT seeded?",
        "language": "en"
    }
    response = client.post("/api/v1/whatsapp/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["language"] == "en"
    assert "whatsapp_message" in data
    # WhatsApp bold and official portal checks
    assert "*" in data["whatsapp_message"]
    assert "myaadhaar.uidai.gov.in" in data["whatsapp_message"] or "NPCI" in data["whatsapp_message"]
    assert len(data["suggested_replies"]) >= 3
    assert "<Response>" in data["twiml"]
    assert data["meta_payload"]["messaging_product"] == "whatsapp"


def test_whatsapp_simulate_shortcut_option_1(client):
    """Verifies quick reply option '1' automatically expands to DBT check."""
    payload = {
        "from_number": "+919876543210",
        "message": "1",
        "language": "en"
    }
    response = client.post("/api/v1/whatsapp/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "DBT" in data["whatsapp_message"] or "Aadhaar" in data["whatsapp_message"]


def test_whatsapp_simulate_telugu_query(client):
    """Verifies citizen query processed in Telugu script and response delivered in Telugu."""
    payload = {
        "from_number": "+919876543210",
        "message": "బ్యాంక్ ఖాతా ఆధార్ DBT సీడింగ్ ఎలా తనిఖీ చేయాలి?",
        "language": "te"
    }
    response = client.post("/api/v1/whatsapp/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["language"] == "te"
    assert data["detected_language"] == "Telugu"
    # Should contain Telugu text
    assert any(ord(c) >= 0x0C00 and ord(c) <= 0x0C7F for c in data["whatsapp_message"])


def test_whatsapp_simulate_hindi_query(client):
    """Verifies citizen query processed in Hindi script and response delivered in Hindi."""
    payload = {
        "from_number": "+919876543210",
        "message": "आधार डीबीटी बैंक खाता सीडिंग स्थिति कैसे जांचें?",
        "language": "hi"
    }
    response = client.post("/api/v1/whatsapp/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["language"] == "hi"
    assert data["detected_language"] == "Hindi"
    # Should contain Devanagari text
    assert any(ord(c) >= 0x0900 and ord(c) <= 0x097F for c in data["whatsapp_message"])


def test_whatsapp_multimodal_audio_note_intake(client):
    """Verifies inbound voice note intake simulation."""
    payload = {
        "from_number": "+919876543210",
        "message": "",
        "media_type": "audio/ogg",
        "language": "en"
    }
    response = client.post("/api/v1/whatsapp/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "Voice Note" in data["whatsapp_message"] or "🎙️" in data["whatsapp_message"]
