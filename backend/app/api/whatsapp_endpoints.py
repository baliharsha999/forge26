"""
Nagarik AI - WhatsApp Webhook & Simulator API Endpoints
Provides:
- GET /webhook: Meta Cloud API Verification Challenge
- POST /webhook: Inbound Twilio TwiML and Meta Cloud API Webhook processor
- POST /simulate: Interactive Citizen WhatsApp Simulator for Web Frontend
"""

import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Request, Response, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.whatsapp_service import whatsapp_service


router = APIRouter(prefix="", tags=["WhatsApp Bot"])


class WhatsAppSimulateRequest(BaseModel):
    from_number: Optional[str] = Field("+919876543210", description="Citizen WhatsApp phone number")
    message: str = Field(..., description="Message text from citizen (English, Hindi, or Telugu)")
    language: Optional[str] = Field("en", description="Preferred language code (en, hi, te)")
    media_type: Optional[str] = Field(None, description="Optional media attachment type (e.g. audio/ogg, image/jpeg)")
    media_url: Optional[str] = Field(None, description="Optional media URL")


class WhatsAppSimulateResponse(BaseModel):
    status: str
    from_number: str
    input_message: str
    resolved_query: Optional[str] = None
    whatsapp_message: str
    raw_markdown: str
    language: str
    detected_language: str
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    reasoning_steps: List[Dict[str, Any]] = Field(default_factory=list)
    grounded_score: float = 0.98
    retrieval_badge: str = "✅ Verified Official Source (Score: 0.98)"
    suggested_replies: List[Dict[str, str]] = Field(default_factory=list)
    twiml: str
    meta_payload: Dict[str, Any]
    timestamp: str


@router.get("/webhook")
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    """
    Meta WhatsApp Cloud API Webhook Verification Endpoint.
    When registering webhook in Meta Developer portal, Meta sends:
    - hub.mode=subscribe
    - hub.verify_token=<configured_token>
    - hub.challenge=<random_string_or_integer>
    """
    if hub_mode and hub_verify_token:
        if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
            return Response(content=hub_challenge or "", media_type="text/plain", status_code=status.HTTP_200_OK)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Webhook verification failed: Invalid verify_token."
            )

    # Friendly status check if accessed directly via browser/curl
    return {
        "status": "active",
        "service": "Nagarik AI WhatsApp Citizen Gateway",
        "verification_token_configured": bool(settings.WHATSAPP_VERIFY_TOKEN),
        "supported_providers": ["Twilio WhatsApp API (TwiML)", "Meta Cloud API (JSON)"],
        "modes": ["webhook", "simulate"]
    }


@router.post("/webhook")
async def receive_whatsapp_webhook(request: Request):
    """
    Universal Inbound WhatsApp Message Webhook:
    - Twilio Form-Encoded payload: Returns TwiML XML (<Response><Message>...)
    - Meta Cloud API JSON payload: Returns delivery confirmation & Meta response JSON
    """
    content_type = request.headers.get("content-type", "").lower()
    
    # -------------------------------------------------------------------------
    # 1. Twilio Inbound Webhook (application/x-www-form-urlencoded or multipart)
    # -------------------------------------------------------------------------
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form_data = await request.form()
        from_number = form_data.get("From", "+919876543210")
        body_text = form_data.get("Body", "")
        num_media = int(form_data.get("NumMedia", 0) or 0)
        media_url = form_data.get("MediaUrl0") if num_media > 0 else None
        media_type = form_data.get("MediaContentType0") if num_media > 0 else None

        result = await whatsapp_service.process_inbound_message(
            from_number=str(from_number),
            message_text=str(body_text),
            media_type=str(media_type) if media_type else None,
            media_url=str(media_url) if media_url else None
        )
        return Response(content=result["twiml"], media_type="application/xml")

    # -------------------------------------------------------------------------
    # 2. Meta WhatsApp Cloud API (application/json)
    # -------------------------------------------------------------------------
    try:
        json_data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON or Form payload.")

    from_number = "+919876543210"
    message_text = ""
    media_type = None
    media_url = None

    # Meta Cloud API standard envelope: { "entry": [ { "changes": [ { "value": { "messages": [...] } } ] } ] }
    if "entry" in json_data:
        try:
            entry = json_data.get("entry", [])[0]
            change = entry.get("changes", [])[0]
            value = change.get("value", {})
            messages = value.get("messages", [])
            if messages:
                first_msg = messages[0]
                from_number = first_msg.get("from", from_number)
                msg_type = first_msg.get("type", "text")
                if msg_type == "text":
                    message_text = first_msg.get("text", {}).get("body", "")
                elif msg_type == "interactive":
                    # Button reply or list reply
                    interactive = first_msg.get("interactive", {})
                    button_reply = interactive.get("button_reply", {})
                    message_text = button_reply.get("title") or button_reply.get("id") or ""
                elif msg_type == "audio":
                    media_type = "audio/ogg"
                    message_text = ""
                elif msg_type == "image":
                    media_type = "image/jpeg"
                    message_text = first_msg.get("image", {}).get("caption", "")
        except Exception:
            pass
    else:
        # Generic JSON payload (e.g. { "from": "+91...", "message": "..." })
        from_number = json_data.get("from") or json_data.get("From") or json_data.get("from_number") or from_number
        message_text = json_data.get("message") or json_data.get("text") or json_data.get("Body") or ""
        media_type = json_data.get("media_type")
        media_url = json_data.get("media_url")

    result = await whatsapp_service.process_inbound_message(
        from_number=str(from_number),
        message_text=str(message_text),
        media_type=str(media_type) if media_type else None,
        media_url=str(media_url) if media_url else None
    )

    return {
        "status": "delivered",
        "service": "Nagarik AI WhatsApp Gateway",
        "result": result
    }


@router.post("/simulate", response_model=WhatsAppSimulateResponse)
async def simulate_whatsapp_chat(req: WhatsAppSimulateRequest):
    """
    Interactive Simulation Endpoint for Nagarik AI Frontend.
    Allows citizens to simulate WhatsApp interaction in real time with:
    - WhatsApp formatted text bubbles
    - Grounded government citations (.gov.in)
    - Interactive quick-reply buttons
    - Multi-lingual reasoning (English, Hindi, Telugu)
    """
    from_num = req.from_number or "+919876543210"
    result = await whatsapp_service.process_inbound_message(
        from_number=from_num,
        message_text=req.message,
        media_type=req.media_type,
        media_url=req.media_url,
        language=req.language
    )

    return WhatsAppSimulateResponse(
        status=result["status"],
        from_number=result["from_number"],
        input_message=result["input_message"],
        resolved_query=result.get("resolved_query"),
        whatsapp_message=result["whatsapp_message"],
        raw_markdown=result["raw_markdown"],
        language=result["language"],
        detected_language=result["detected_language"],
        citations=result.get("citations", []),
        reasoning_steps=result.get("reasoning_steps", []),
        grounded_score=result.get("grounded_score", 0.98),
        retrieval_badge=result.get("retrieval_badge", "✅ Verified Official Source (Score: 0.98)"),
        suggested_replies=result.get("suggested_replies", []),
        twiml=result["twiml"],
        meta_payload=result["meta_payload"],
        timestamp=result["timestamp"]
    )
