"""
Nagarik AI - Standalone WhatsApp Bot Microservice Entrypoint
Run with:
    python -m backend.whatsapp_bot.main
Or:
    uvicorn backend.whatsapp_bot.main:app --host 0.0.0.0 --port 8001 --reload
"""

import sys
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import bot_config
from .webhook_handlers import router as webhook_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nagarik_ai.whatsapp_service")

# Initialize standalone FastAPI app
app = FastAPI(
    title=bot_config.SERVICE_NAME,
    version=bot_config.VERSION,
    description="Dedicated WhatsApp Bot Service for Nagarik AI - Empowering Every Citizen via Meta Cloud API & Twilio."
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Webhook Router at root and prefixed
app.include_router(webhook_router)
app.include_router(webhook_router, prefix="/api/v1/whatsapp")


@app.get("/")
def root():
    return {
        "service": bot_config.SERVICE_NAME,
        "version": bot_config.VERSION,
        "status": "ready",
        "description": "Multilingual WhatsApp Bot Gateway (Telugu, Hindi, English) with Zero-Knowledge PII Shielding",
        "endpoints": {
            "meta_webhook_verify": "GET /webhook",
            "inbound_webhook": "POST /webhook",
            "citizen_simulator": "POST /simulate",
            "health_diagnostics": "GET /health"
        }
    }


def main():
    logger.info(f"Starting {bot_config.SERVICE_NAME} on port {bot_config.PORT}...")
    uvicorn.run(
        "backend.whatsapp_bot.main:app",
        host="0.0.0.0",
        port=bot_config.PORT,
        reload=False
    )


if __name__ == "__main__":
    main()
