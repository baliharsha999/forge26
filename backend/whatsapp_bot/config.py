"""
Nagarik AI - WhatsApp Bot Service Configuration
Supports Meta WhatsApp Cloud API, Twilio WhatsApp Sandbox, Groq Whisper, and Supabase RAG.
"""

import os
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from dotenv import load_dotenv

# Search for .env files up to project root
_curr = Path(__file__).resolve().parent
for _candidate in [_curr / ".env", _curr.parent / ".env", _curr.parent.parent / ".env"]:
    if _candidate.exists():
        load_dotenv(dotenv_path=_candidate, override=False)


class WhatsAppBotConfig(BaseModel):
    # Service Information
    SERVICE_NAME: str = "Nagarik AI - WhatsApp Bot Gateway"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("WHATSAPP_PORT", "8001"))
    
    # Meta WhatsApp Cloud API
    WHATSAPP_VERIFY_TOKEN: str = os.getenv("WHATSAPP_VERIFY_TOKEN", "nagarik_ai_secure_token")
    WHATSAPP_ACCESS_TOKEN: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    META_GRAPH_VERSION: str = os.getenv("META_GRAPH_VERSION", "v21.0")
    
    # Twilio WhatsApp Sandbox / API
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_WHATSAPP_NUMBER: str = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
    DEFAULT_CITIZEN_PHONE: str = os.getenv("WHATSAPP_PHONE_NUMBER", "+919876543210")
    
    # AI & Speech Processing Keys
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_WHISPER_MODEL: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
    GROQ_LLM_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # Supabase Integration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Local SQLite / RAG Engine Fallback
    RAG_BACKEND_URL: str = os.getenv("RAG_BACKEND_URL", "http://127.0.0.1:8000")
    SCHEME_PROVIDER_TYPE: str = os.getenv("SCHEME_PROVIDER_TYPE", "local")
    
    # Zero-Knowledge Security & Privacy
    MASK_AADHAAR: bool = True
    MASK_PHONE: bool = True
    MASK_PAN: bool = True
    MASK_BANK_ACCOUNT: bool = True
    
    # Supported Languages
    SUPPORTED_LANGUAGES: List[str] = ["en", "hi", "te"]
    DEFAULT_LANGUAGE: str = "en"


bot_config = WhatsAppBotConfig()
