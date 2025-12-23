from typing import List, Dict
import requests

from config import settings

SERPER_URL = "https://google.serper.dev/search"


class WebSearchResultDict(Dict[str, str]):
    title: str
    snippet: str
    link: str


def web_search(query: str, num_results: int = 5) -> List[WebSearchResultDict]:
    """
    Call Serper web search API and return a list of simple results.
    """
    if not settings.SERPER_API_KEY:
        raise ValueError("SERPER_API_KEY is not set in .env")

    headers = {
        "X-API-KEY": settings.SERPER_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "q": query,
        "num": num_results,
    }

    resp = requests.post(SERPER_URL, headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    results: List[WebSearchResultDict] = []
    for item in data.get("organic", []):
        results.append(
            {
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "link": item.get("link", ""),
            }
        )

    return results
