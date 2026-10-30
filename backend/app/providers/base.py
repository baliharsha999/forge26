from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from app.models.schemas import NormalizedScheme

class SchemeProvider(ABC):
    """
    Abstract interface for government scheme discovery and verification.
    Provides pluggable backends: API Setu (myScheme live), Data.gov.in, and Local Hand-Verified store.
    """

    @abstractmethod
    async def get_schemes(
        self,
        category: Optional[str] = None,
        state: Optional[str] = None,
        query: Optional[str] = None
    ) -> List[NormalizedScheme]:
        """Retrieve and filter normalized government schemes."""
        pass

    @abstractmethod
    async def get_scheme_by_id(self, scheme_id: str) -> Optional[NormalizedScheme]:
        """Fetch a single scheme by its unique identifier."""
        pass

    @abstractmethod
    async def verify_claim(self, claim_text: str) -> Dict[str, Any]:
        """
        Verify a citizen claim against official scheme records.
        Returns outcome: 'matches', 'contradicts', or 'unverified' with exact quoted source_text.
        """
        pass
