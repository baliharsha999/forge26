# 🏛️ Nagarik AI — WhatsApp Citizen Bot Service

> **"Empowering Every Citizen"** • Sovereign Public Intelligence via WhatsApp  
> Native Multilingual Support (Telugu, Hindi, English) • Voice Notes • Zero-Knowledge PII Protection • Verified Government Portals (`.gov.in`)

---

## 🌟 Key Capabilities

1. **Dual Gateway Compatibility**:
   - **Meta WhatsApp Cloud API**: Supports Webhook Verification (`GET /webhook`), Inbound JSON processing (`POST /webhook`), and interactive reply buttons.
   - **Twilio WhatsApp Sandbox & Production**: Supports form-encoded webhooks with TwiML XML (`<Response><Message><Body>...</Body></Message></Response>`).

2. **Multilingual Voice Notes (Speech-to-Text)**:
   - Voice note audio files (OGG / AMR / MP3 / WAV) sent via WhatsApp are automatically fetched and transcribed via **Groq Whisper (`whisper-large-v3-turbo`)** or **Google Gemini Multimodal Audio**.
   - Spoken Telugu, Hindi, and English are transcribed with sovereign civic domain prompts.

3. **Zero-Knowledge PII Shielding**:
   - **Aadhaar Protection**: 12-digit UID numbers (`[2-9]\d{3}\s?\d{4}\s?\d{4}`) are auto-masked as `XXXX-XXXX-1234`.
   - **Phone Protection**: Indian mobile numbers are masked (`+91-XXXXX-XX345`) before passing to LLMs or persistent storage.
   - **PAN & Voter ID**: Income Tax PAN (`ABXXXXX12F`) and Election EPIC Voter IDs (`ABCXXXX123`) are auto-sanitized.
   - Privacy advisory notifications are automatically appended in the citizen's chosen language.

4. **100% Grounded Civic Scheme RAG**:
   - Connected to **Supabase PostgreSQL (`pgvector`)** and the **STAIR Agentic Workflow Engine**.
   - Answers cite official government URLs (`pmkisan.gov.in`, `myaadhaar.uidai.gov.in`, `nha.gov.in`, `pgportal.gov.in`).

---

## 📁 Directory Architecture

```
backend/whatsapp_bot/
├── __init__.py               # Package re-exports
├── config.py                 # Bot settings, env vars, defaults
├── pii_shield.py             # Zero-knowledge PII masking engine
├── language.py               # Multilingual detection (Telugu, Hindi, English)
├── audio_transcriber.py      # Voice note audio transcriber (Groq Whisper / Gemini)
├── rag_router.py             # Scheme RAG and Supabase router
├── bot_engine.py             # Core conversational state & message builder
├── webhook_handlers.py       # FastAPI endpoints (/webhook, /simulate, /health)
├── main.py                   # Standalone FastAPI service entrypoint
├── test_bot.py               # Comprehensive automated unit tests
├── .env.example              # Environment variables template
└── README.md                 # Complete documentation
```

---

## 🚀 Quick Start Guide

### 1. Standalone Execution

Run directly using Python or Uvicorn:

```bash
# From workspace root
d:\buildathon\backend\venv\Scripts\python -m backend.whatsapp_bot.main
```

Or with Uvicorn:
```bash
uvicorn backend.whatsapp_bot.main:app --host 0.0.0.0 --port 8001 --reload
```

The service will be online at: `http://localhost:8001`
- **Root Status**: `http://localhost:8001/`
- **Health Diagnostics**: `http://localhost:8001/health`
- **Interactive Simulator**: `http://localhost:8001/simulate`

---

## ⚙️ Configuration & Setup

### Option A: Meta WhatsApp Cloud API Setup

1. Go to [developers.facebook.com](https://developers.facebook.com) and create or select your Meta App with **WhatsApp product**.
2. Navigate to **WhatsApp > Configuration > Webhook**.
3. Set **Callback URL**:
   ```
   https://<your-ngrok-or-domain>/webhook
   ```
4. Set **Verify Token**:
   - Matches `WHATSAPP_VERIFY_TOKEN` in your `.env` (default: `nagarik_ai_secure_token`).
5. Click **Verify and Save**. Meta will dispatch a `GET` request:
   ```
   GET /webhook?hub.mode=subscribe&hub.verify_token=nagarik_ai_secure_token&hub.challenge=1158201244
   ```
   The bot verifies the token and immediately echoes `hub.challenge` with HTTP 200 OK.
6. Subscribe to the `messages` webhook field.

### Option B: Twilio WhatsApp Sandbox Setup

1. Create a Twilio account and open **Messaging > Try WhatsApp > WhatsApp Sandbox**.
2. From your personal WhatsApp, send the join code (e.g. `join simple-orbit`) to `+1 415 523 8886`.
3. In Twilio Sandbox settings:
   - **WHEN A MESSAGE COMES IN**: Set Webhook URL to `https://<your-ngrok-or-domain>/webhook` with **HTTP POST**.
4. Citizen replies will receive instant TwiML formatted WhatsApp bubbles with verified `.gov.in` citations.

---

## 🧪 Interactive Citizen Simulation (Zero Install)

Developers and frontend engineers can test without live webhooks using the `/simulate` endpoint:

### Example 1: English DBT Query
```bash
curl -X POST "http://localhost:8001/simulate" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I check if my bank account is Aadhaar DBT seeded?"}'
```

### Example 2: Telugu Scheme Query
```bash
curl -X POST "http://localhost:8001/simulate" \
  -H "Content-Type: application/json" \
  -d '{"message": "PM-కిసాన్ పథకం ₹6000 సహాయం వివరాలు చెప్పండి"}'
```

### Example 3: Voice Note with Aadhaar Masking
```bash
curl -X POST "http://localhost:8001/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "My Aadhaar number is 5432 9876 1234 and phone 9876543210. How to apply for Ayushman Bharat?",
    "media_type": "audio/ogg"
  }'
```

**Zero-Knowledge Response Output**:
- The 12-digit Aadhaar `5432 9876 1234` is instantly masked to `XXXX-XXXX-1234`.
- The phone number `9876543210` is masked to `+91-XXXXX-XX210`.
- Privacy notice badge is included: `🔒 Zero-Knowledge Privacy Shield Active: Sensitive identifier detected (Aadhaar Number (UIDAI), Citizen Phone Number) and auto-masked.`

---

## 🔒 Security & Privacy Guarantees

- **Zero-Knowledge Architecture**: Citizen identity numbers (Aadhaar, PAN, Voter ID, Phone numbers) are scrubbed at the gateway entrance.
- **No Identity Storage**: Government identity numbers are NEVER persisted to SQLite, Supabase, or external LLM contexts.
- **Official Grounding Only**: Citations are restricted to official `.gov.in` domains.
