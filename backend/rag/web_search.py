from __future__ import annotations

from typing import Any, Dict, List
import re
import requests

from config import settings


# Mortgage-industry specific terms only (avoid generic words).
_MORTGAGE_QUERY_RX = re.compile(
    r"(?i)\b("
    r"mortgage|home\s+loan|refinance|cash-?out\s+refinance|heloc|"
    r"fhfa|gse|fannie|freddie|ginnie|gnma|"
    r"fha|va\s+loan|usda\s+loan|"
    r"conforming\s+loan\s+limit|jumbo\s+loan|"
    r"underwriting|origination|servicing|loss\s+mitigation|forbearance|foreclosure|"
    r"mbs|mortgage-?backed|"
    r"loan\s+estimate|closing\s+disclosure|trid|tila|respa|hmda|cfpb|"
    r"escrow|pmi|mip|llpa|dti|ltv|fico"
    r")\b"
)

def _is_mortgage_query(query: str) -> bool:
    return bool(_MORTGAGE_QUERY_RX.search(query or ""))


def serper_search(query: str, num_results: int = 5) -> List[Dict[str, Any]]:
    api_key = (settings.SERPER_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError("Missing SERPER_API_KEY in .env")

    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json",
    }
    payload: Dict[str, Any] = {
        "q": query,
        "num": num_results,
        "gl": settings.SERPER_GL,
        "hl": settings.SERPER_HL,
    }

    r = requests.post(url, headers=headers, json=payload, timeout=20)
    r.raise_for_status()
    data = r.json()

    out: List[Dict[str, Any]] = []
    organic = data.get("organic") or []
    for item in organic[:num_results]:
        out.append(
            {
                "title": item.get("title"),
                "link": item.get("link"),
                "snippet": item.get("snippet"),
                "position": item.get("position"),
                "source": "serper",
            }
        )
    return out


def web_search(query: str, num_results: int = 5) -> List[Dict[str, Any]]:
    # Mortgage-industry-only: don't fetch anything for non-mortgage prompts.
    if not _is_mortgage_query(query):
        return []
    return serper_search(query, num_results=num_results)
