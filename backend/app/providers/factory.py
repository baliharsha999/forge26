from app.providers.base import SchemeProvider
from app.providers.local_provider import LocalSchemeProvider
from app.providers.apisetu_provider import ApiSetuSchemeProvider
from app.core.config import settings

_provider_instance: SchemeProvider = None

def get_scheme_provider() -> SchemeProvider:
    """
    Factory function returning the configured SchemeProvider.
    Defaults to LocalSchemeProvider for 100% test reliability and instant local speed,
    or ApiSetuSchemeProvider when configured via SCHEME_PROVIDER_TYPE=apisetu.
    """
    global _provider_instance
    if _provider_instance is None:
        if settings.SCHEME_PROVIDER_TYPE == "apisetu":
            _provider_instance = ApiSetuSchemeProvider()
        else:
            _provider_instance = LocalSchemeProvider()
    return _provider_instance
