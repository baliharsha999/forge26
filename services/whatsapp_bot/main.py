"""
Nagarik AI - Standalone Runner Bridge for services/whatsapp_bot/
"""

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent.parent
_backend = _root / "backend"
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from backend.whatsapp_bot.main import app, main

if __name__ == "__main__":
    main()
