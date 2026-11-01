"""
Nagarik AI - WhatsApp Webhook & Simulator Handlers
FastAPI routes for:
- Meta WhatsApp Cloud API Verification (GET /webhook)
- Universal Inbound Processing (POST /webhook for Meta & Twilio)
- Interactive Simulation (POST /simulate)
- Health Diagnostics (GET /health)
"""

import json
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Request, Response, HTTPException, Query, status
from pydantic import BaseModel, Field

from .config import bot_config
from .bot_engine import bot_engine, BotProcessResult

logger = logging.getLogger("nagarik_ai.whatsapp_webhook")

router = APIRouter(prefix="", tags=["Nagarik WhatsApp Bot"])


class SimulateRequest(BaseModel):
    from_number: Optional[str] = Field("+919876543210", description="Citizen WhatsApp phone number")
    message: str = Field(..., description="Message text or simulated voice note")
    language: Optional[str] = Field(None, description="Optional language override (en, hi, te)")
    media_type: Optional[str] = Field(None, description="Optional media MIME type (audio/ogg, image/jpeg)")
    media_url: Optional[str] = Field(None, description="Optional media URL")


@router.get("/webhook")
async def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    """
    Meta WhatsApp Cloud API Webhook Verification Endpoint.
    Meta sends GET request with hub.mode, hub.verify_token, and hub.challenge.
    """
    if hub_mode and hub_verify_token:
        if hub_mode == "subscribe" and hub_verify_token == bot_config.WHATSAPP_VERIFY_TOKEN:
            logger.info("Meta Webhook Verification successful.")
            return Response(content=hub_challenge or "", media_type="text/plain", status_code=status.HTTP_200_OK)
        else:
            logger.warning("Meta Webhook Verification failed: Invalid verify token.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Webhook verification failed: Invalid verify_token."
            )

    return {
        "status": "online",
        "service": bot_config.SERVICE_NAME,
        "version": bot_config.VERSION,
        "meta_verify_token_configured": bool(bot_config.WHATSAPP_VERIFY_TOKEN),
        "supported_providers": ["Twilio WhatsApp Sandbox", "Meta WhatsApp Cloud API"],
        "endpoints": {
            "webhook": "/webhook",
            "simulate": "/simulate",
            "health": "/health"
        }
    }


@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Universal Inbound Webhook Endpoint:
    - Twilio Form-Encoded (returns TwiML XML)
    - Meta Cloud API JSON (returns JSON acknowledgment and sends reply)
    """
    content_type = request.headers.get("content-type", "").lower()

    # -------------------------------------------------------------------------
    # 1. Twilio Inbound Webhook (Form URL-Encoded or Multipart)
    # -------------------------------------------------------------------------
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form_data = await request.form()
        from_number = form_data.get("From", bot_config.DEFAULT_CITIZEN_PHONE)
        body_text = form_data.get("Body", "")
        num_media = int(form_data.get("NumMedia", 0) or 0)
        media_url = form_data.get("MediaUrl0") if num_media > 0 else None
        media_type = form_data.get("MediaContentType0") if num_media > 0 else None

        result = await bot_engine.process_message(
            from_number=str(from_number),
            message_text=str(body_text),
            media_type=str(media_type) if media_type else None,
            media_url=str(media_url) if media_url else None
        )
        return Response(content=result.twiml, media_type="application/xml")

    # -------------------------------------------------------------------------
    # 2. Meta WhatsApp Cloud API (JSON Payload)
    # -------------------------------------------------------------------------
    try:
        json_data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON or Form payload.")

    from_number = bot_config.DEFAULT_CITIZEN_PHONE
    message_text = ""
    media_type = None
    media_url = None

    if "entry" in json_data:
        try:
            entry = json_data.get("entry", [])[0]
            change = entry.get("changes", [])[0]
            value = change.get("value", {})
            messages = value.get("messages", [])

            if messages:
                msg = messages[0]
                from_number = msg.get("from", from_number)
                msg_type = msg.get("type", "text")

                if msg_type == "text":
                    message_text = msg.get("text", {}).get("body", "")
                elif msg_type == "interactive":
                    interactive = msg.get("interactive", {})
                    button_reply = interactive.get("button_reply", {})
                    message_text = button_reply.get("id") or button_reply.get("title") or ""
                elif msg_type == "audio":
                    media_type = "audio/ogg"
                    media_id = msg.get("audio", {}).get("id")
                    if media_id:
                        media_url = f"https://graph.facebook.com/{bot_config.META_GRAPH_VERSION}/{media_id}"
                elif msg_type == "button":
                    button = msg.get("button", {})
                    message_text = button.get("text") or button.get("payload") or ""
            else:
                # Meta message status updates (sent, delivered, read)
                return {"status": "status_event_received"}
        except Exception as e:
            logger.warning(f"Error parsing Meta payload: {e}")
    else:
        # Generic payload fallback
        from_number = json_data.get("from") or json_data.get("From") or from_number
        message_text = json_data.get("message") or json_data.get("text") or json_data.get("Body") or ""
        media_type = json_data.get("media_type")
        media_url = json_data.get("media_url")

    result = await bot_engine.process_message(
        from_number=str(from_number),
        message_text=str(message_text),
        media_type=str(media_type) if media_type else None,
        media_url=str(media_url) if media_url else None
    )

    # If Meta Graph API credentials are set, optionally dispatch outbound
    if bot_config.WHATSAPP_ACCESS_TOKEN and bot_config.WHATSAPP_PHONE_NUMBER_ID:
        await bot_engine.send_meta_cloud_message(from_number, result.whatsapp_message)

    return {
        "status": "delivered",
        "service": bot_config.SERVICE_NAME,
        "result": result.model_dump()
    }


@router.post("/simulate", response_model=BotProcessResult)
async def simulate_interaction(req: SimulateRequest):
    """
    Simulates a citizen interacting with the WhatsApp bot.
    Returns WhatsApp formatted bubbles, raw markdown, citations, TwiML, and Meta JSON.
    """
    res = await bot_engine.process_message(
        from_number=req.from_number or bot_config.DEFAULT_CITIZEN_PHONE,
        message_text=req.message,
        media_type=req.media_type,
        media_url=req.media_url,
        forced_language=req.language
    )
    return res


@router.get("/health")
async def health_check():
    """
    Health check diagnostic endpoint.
    """
    return {
        "status": "healthy",
        "service": bot_config.SERVICE_NAME,
        "version": bot_config.VERSION,
        "environment": bot_config.ENVIRONMENT,
        "meta_cloud_api": {
            "configured": bool(bot_config.WHATSAPP_ACCESS_TOKEN and bot_config.WHATSAPP_PHONE_NUMBER_ID),
            "phone_number_id": bot_config.WHATSAPP_PHONE_NUMBER_ID or "not_set",
            "verify_token_set": bool(bot_config.WHATSAPP_VERIFY_TOKEN)
        },
        "twilio_sandbox": {
            "configured": bool(bot_config.TWILIO_ACCOUNT_SID and bot_config.TWILIO_AUTH_TOKEN),
            "number": bot_config.TWILIO_WHATSAPP_NUMBER
        },
        "speech_transcription": {
            "groq_whisper": bool(bot_config.GROQ_API_KEY),
            "gemini_audio": bool(bot_config.GEMINI_API_KEY)
        },
        "database_rag": {
            "supabase_connected": bool(bot_config.SUPABASE_URL),
            "provider": bot_config.SCHEME_PROVIDER_TYPE
        },
        "zero_knowledge_pii_shield": {
            "mask_aadhaar": bot_config.MASK_AADHAAR,
            "mask_phone": bot_config.MASK_PHONE,
            "mask_pan": bot_config.MASK_PAN
        }
    }
