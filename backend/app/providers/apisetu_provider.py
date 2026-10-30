import os
import json
import httpx
import logging
from typing import List, Optional, Dict, Any
from app.models.schemas import NormalizedScheme
from app.providers.base import SchemeProvider
from app.providers.local_provider import LocalSchemeProvider
from app.core.config import settings

logger = logging.getLogger("apisetu_provider")

CACHE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/cache/apisetu_cache.json"))

class ApiSetuSchemeProvider(SchemeProvider):
    """
    Official API Setu / myScheme provider.
    Handles partner authentication (X-APISETU-CLIENTID, X-APISETU-APIKEY),
    normalizes dynamic government schemas, and caches results locally.
    """

    def __init__(self):
        self.base_url = settings.APISETU_BASE_URL
        self.client_id = settings.APISETU_CLIENT_ID
        self.api_key = settings.APISETU_API_KEY
        self.timeout = settings.APISETU_TIMEOUT_SECONDS
        self.fallback_local = LocalSchemeProvider()
        self._ensure_cache_dir()

    def _ensure_cache_dir(self):
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)

    def _save_to_cache(self, schemes: List[NormalizedScheme]):
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump([s.model_dump() for s in schemes], f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to write API Setu cache: {e}")

    def _read_from_cache(self) -> List[NormalizedScheme]:
        if not os.path.exists(CACHE_FILE):
            return []
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return [NormalizedScheme(**item) for item in data]
        except Exception as e:
            logger.warning(f"Failed to read API Setu cache: {e}")
            return []

    def _normalize_api_record(self, raw: Dict[str, Any], idx: int) -> NormalizedScheme:
        """Dynamically normalizes API Setu response fields into canonical NormalizedScheme."""
        scheme_id = str(raw.get("id") or raw.get("scheme_id") or f"APISETU-{idx:03d}")
        name = str(raw.get("name") or raw.get("scheme_name") or raw.get("title") or "Unnamed Scheme")
        benefit = str(raw.get("benefit") or raw.get("brief_description") or raw.get("description") or "Benefits specified by department.")
        
        # Criteria parsing
        raw_criteria = raw.get("eligibility_criteria") or raw.get("eligibility") or raw.get("criteria") or []
        if isinstance(raw_criteria, str):
            criteria = [c.strip() for c in raw_criteria.split(";") if c.strip()]
        elif isinstance(raw_criteria, list):
            criteria = [str(c) for c in raw_criteria]
        else:
            criteria = ["Citizen meeting departmental criteria"]

        # Documents parsing
        raw_docs = raw.get("documents_required") or raw.get("documents") or []
        if isinstance(raw_docs, str):
            docs = [d.strip() for d in raw_docs.split(",") if d.strip()]
        elif isinstance(raw_docs, list):
            docs = [str(d) for d in raw_docs]
        else:
            docs = ["Aadhaar Card", "Bank Account Details"]

        official_url = str(raw.get("official_url") or raw.get("url") or raw.get("link") or "https://myscheme.gov.in")
        source_text = str(raw.get("source_text") or benefit)
        last_verified = str(raw.get("last_verified_date") or "2026-10-30")

        return NormalizedScheme(
            id=scheme_id,
            name=name,
            level=raw.get("level", "central"),
            state=raw.get("state", "All-India"),
            category=raw.get("category", "general"),
            benefit=benefit,
            eligibility_criteria=criteria,
            documents_required=docs,
            how_to_apply=raw.get("how_to_apply", f"Visit {official_url}"),
            official_url=official_url,
            source_text=source_text,
            last_verified_date=last_verified,
            source_provider="apisetu_live"
        )

    async def get_schemes(
        self,
        category: Optional[str] = None,
        state: Optional[str] = None,
        query: Optional[str] = None
    ) -> List[NormalizedScheme]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "JanSetuLite/1.0",
        }
        if self.client_id:
            headers["X-APISETU-CLIENTID"] = self.client_id
        if self.api_key:
            headers["X-APISETU-APIKEY"] = self.api_key

        # 1. Attempt Live Call if keys are configured
        if self.api_key and self.client_id:
            try:
                params = {}
                if category and category != "all":
                    params["category"] = category
                if state and state != "All-India":
                    params["state"] = state
                if query:
                    params["q"] = query

                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.get(f"{self.base_url}/schemes", headers=headers, params=params)
                    if resp.status_code == 200:
                        raw_items = resp.json()
                        if isinstance(raw_items, dict) and "data" in raw_items:
                            raw_items = raw_items["data"]
                        normalized = [self._normalize_api_record(item, i) for i, item in enumerate(raw_items)]
                        self._save_to_cache(normalized)
                        return normalized
                    else:
                        logger.warning(f"API Setu returned HTTP {resp.status_code}. Using cache/fallback.")
            except Exception as e:
                logger.warning(f"API Setu request failed: {e}. Falling back gracefully.")

        # 2. Check local disk cache
        cached = self._read_from_cache()
        if cached:
            # Filter cached records
            results = cached
            if category and category.lower() != "all":
                results = [s for s in results if s.category.lower() == category.lower()]
            if state and state.lower() != "all-india":
                results = [s for s in results if s.state.lower() in ["all-india", state.lower()]]
            if query and query.strip():
                q = query.lower().strip()
                results = [s for s in results if q in s.name.lower() or q in s.benefit.lower()]
            for s in results:
                s.source_provider = "apisetu_cache"
            return results

        # 3. Graceful fallback to verified LocalSchemeProvider
        logger.info("Falling back to local hand-verified schemes store.")
        return await self.fallback_local.get_schemes(category=category, state=state, query=query)

    async def get_scheme_by_id(self, scheme_id: str) -> Optional[NormalizedScheme]:
        # Check cache then fallback
        cached = self._read_from_cache()
        for s in cached:
            if s.id.lower() == scheme_id.lower():
                return s
        return await self.fallback_local.get_scheme_by_id(scheme_id)

    async def verify_claim(self, claim_text: str) -> Dict[str, Any]:
        # Always verify against hand-verified source_text records to prevent hallucination
        return await self.fallback_local.verify_claim(claim_text)
