"""
Nagarik AI - Services / WhatsApp Bot Re-export Bridge
Provides full backward and forward compatibility with both backend/whatsapp_bot/ and services/whatsapp_bot/.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path so whatsapp_bot is discoverable
_root = Path(__file__).resolve().parent.parent.parent
_backend = _root / "backend"
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

try:
    from whatsapp_bot import *
except ImportError:
    from backend.whatsapp_bot import *
