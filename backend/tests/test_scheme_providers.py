import asyncio
import pytest
from app.providers.local_provider import LocalSchemeProvider
from app.providers.apisetu_provider import ApiSetuSchemeProvider
from app.providers.factory import get_scheme_provider

def test_local_scheme_provider():
    async def run():
        provider = LocalSchemeProvider()
        schemes = await provider.get_schemes(category="farmer")
        assert len(schemes) >= 1
        pm_kisan = next((s for s in schemes if "PM-KISAN" in s.name), None)
        assert pm_kisan is not None
        assert "₹6,000" in pm_kisan.benefit
        assert pm_kisan.last_verified_date == "2026-10-30"
    asyncio.run(run())

def test_claim_checker_three_outcomes():
    async def run():
        provider = LocalSchemeProvider()
        
        # 1. Matches
        m_res = await provider.verify_claim("PM-KISAN gives farmers Rs 6,000 per year in three installments")
        assert m_res["outcome"] == "matches"
        assert "source_text" in m_res or "exact_source_text" in m_res

        # 2. Contradicts
        c_res = await provider.verify_claim("PM Free Laptop Scheme giving free laptops to everyone")
        assert c_res["outcome"] == "contradicts"

        # 3. Unverified (Never guess or label fake without data)
        u_res = await provider.verify_claim("Random unknown municipal grant of 50 rupees")
        assert u_res["outcome"] == "unverified"
    asyncio.run(run())

def test_apisetu_provider_fallback():
    async def run():
        provider = ApiSetuSchemeProvider()
        # Without real API keys, it must gracefully fallback to local hand-verified schemes
        schemes = await provider.get_schemes()
        assert len(schemes) >= 10
    asyncio.run(run())
