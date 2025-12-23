from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

from .llm import call_llm
from .web_search import serper_search


# ======================================================
# CONFIG
# ======================================================
SERPER_RESULTS_PER_QUERY = 8
MAX_FETCH_CANDIDATES = 30
MAX_ITEMS_FOR_LLM = 10

ALLOWED_WINDOWS = {7, 14, 30}
DEFAULT_WINDOW_DAYS = 30
MIN_NEWS_ITEMS = 4
TIMEOUT_SECS = 10


# ======================================================
# NEWS QUERY EXPANSION (CRITICAL FIX)
# ======================================================
NEWS_TOPIC_EXPANSIONS = [
    "mortgage rates",
    "interest rates",
    "home prices",
    "real estate trends",
    "housing market trends",
    "feds and mortgages",
    "federal reserve and mortgages",
    "refinance trends",
    "loan origination",
    "loan servicing",
    "mortgage-backed securities",
    "MBA mortgage",
    "mortgage industry news",
    "U.S. real estate",
    "home loans",
    "housing market analysis",
    "mortgage industry trends",
    "mortgage market updates",
    "interest rate changes",
    "Federal Reserve policies",
    "housing market forecasts",
    "mortgage industry regulations",
    "mortgage industry outlook",
    "housing market statistics",
    "U.S. home sales",
    "housing affordability",
    "mortgage lenders",
    "refinancing activity",
    "Fannie Mae mortgage",
    "Freddie Mac mortgage",
    "CFPB mortgage",
    "FHFA housing",
    "U.S. housing market",
]


PREFERRED_NEWS_DOMAINS = [
    "apnews.com",
    "nytimes.com",
    "washingtonpost.com",
    "cnbc.com",
    "forbes.com",
    "marketwatch.com",
    "cnn.com",
    "nbcnews.com",
    "abcnews.go.com",
    "usatoday.com",
    "foxnews.com",
    "bbc.com",
    "theguardian.com",
    "wsbtv.com",
    "nbcchicago.com",
    "reuters.com",
    "bloomberg.com",
    "wsj.com",
    "housingwire.com",
    "nationalmortgagenews.com",
    "mpamag.com",
    "scotsmanguide.com",
]


DENIED_DOMAINS = {
    "facebook.com",
    "twitter.com",
    "x.com",
    "reddit.com",
    "youtube.com",
}


# ======================================================
# HTTP
# ======================================================
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36"
    )
}


# ======================================================
# INDUSTRY + INTENT GATING
# ======================================================
INDUSTRY_CONTEXT_TERMS = [
    "mortgage",
    "feds",
    "federal reserve",
    "interest rates",
    "refinance",
    "refinancing",
    "mortgage-backed securities",
    "mba",
    "mortgage industry",
    "mortgage market",
    "rates",
    "housing trends",
    "real estate trends",
    "housing market trends",
    "refi trends",
    "home prices",
    "real estate",
    "housing market",
    "home sales",
    "housing affordability",
    "loan origination",
    "mortgage lenders",
    "loan servicing",
    "housing",
    "home loan",
    "mortgage rates",
    "mbs",
    "fannie",
    "freddie",
    "cfpb",
    "fhfa",
]

CONSUMER_INTENT_TERMS = [
    "should i",
    "should we",
    "is it a good time",
    "is now a good time",
    "best mortgage",
    "best loan",
    "my mortgage",
    "my loan",
    "calculate",
    "emi",
    "apr for me",
]


def is_industry_specific_question(prompt: str) -> bool:
    p = (prompt or "").lower()
    if any(t in p for t in CONSUMER_INTENT_TERMS):
        return False
    return any(t in p for t in INDUSTRY_CONTEXT_TERMS)


# ======================================================
# TIMELINE PARSING
# ======================================================
TIMELINE_PATTERNS = [
    (re.compile(r"\b(this week|past week|last week|7 days?)\b", re.I), 7),
    (re.compile(r"\b(two weeks|14 days?)\b", re.I), 14),
    (re.compile(r"\b(one month|monthly|30 days?)\b", re.I), 30),
]


def extract_days(prompt: str) -> int:
    if not prompt:
        return DEFAULT_WINDOW_DAYS

    for pat, days in TIMELINE_PATTERNS:
        if pat.search(prompt):
            return days

    m = re.search(r"last\s+(\d+)\s+days", prompt, re.I)
    if m:
        try:
            d = int(m.group(1))
            if d in ALLOWED_WINDOWS:
                return d
        except Exception:
            pass

    return DEFAULT_WINDOW_DAYS


# ======================================================
# URL HELPERS
# ======================================================
def _domain_from_url(url: str) -> str:
    m = re.search(r"https?://([^/]+)/?", url)
    return (m.group(1) if m else "").replace("www.", "").lower()


def _is_denied(domain: str) -> bool:
    return any(d in domain for d in DENIED_DOMAINS)


# ======================================================
# DATE EXTRACTION
# ======================================================
ISO_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


def _try_parse_date(s: str) -> Optional[datetime]:
    try:
        dt = datetime.fromisoformat(s.replace("Z", ""))
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def fetch_published_date(url: str) -> Optional[datetime]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT_SECS)
        if r.status_code >= 400:
            return None
    except Exception:
        return None

    soup = BeautifulSoup(r.text, "html.parser")

    for meta in soup.find_all("meta"):
        if meta.get("property") in {"article:published_time", "og:published_time"}:
            return _try_parse_date(meta.get("content"))

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.text)
            if isinstance(data, dict) and "datePublished" in data:
                return _try_parse_date(data["datePublished"])
        except Exception:
            continue

    m = ISO_RE.search(soup.get_text(" ", strip=True))
    if m:
        return _try_parse_date(m.group())

    return None


# ======================================================
# CLUSTERING
# ======================================================
CLUSTERS = [
    ("Regulatory", ["cfpb", "fhfa", "rule", "enforcement"]),
    ("Policy", ["fed", "federal reserve", "interest rate", "monetary"]),
    ("Sales", ["home sales", "housing market", "real estate"]),
    ("Rates", ["mortgage rates", "refinance", "refi", "interest rates"]),
    ("Prices", ["home prices", "housing affordability"]),
    ("Lenders", ["lender", "loan origination", "loan servicing"]),
    ("Securities", ["mortgage-backed securities", "mbs"]),
    ("Refinance", ["refinance trends", "refi trends"]),
    ("Servicing", ["loan servicing", "servicer"]),
    ("Origination", ["loan origination", "originations"]),
    ("Fed", ["feds", "federal reserve"]),
    ("MBS", ["mortgage-backed securities", "mbs"]),
    ("Lending", ["mortgage lenders", "lender"]),
    ("Refi", ["refinance", "refi"]),
    ("Housing", ["housing trends", "real estate trends", "housing market trends"]),
    ("Real Estate", ["real estate", "housing market", "home sales"]),
    ("Home Prices", ["home prices", "housing affordability"]),
    ("Loans", ["home loan", "mortgage loan"]),
    ("Origination", ["loan origination", "originations"]),
    ("Servicers", ["loan servicing", "servicer"]),
    ("Regulation", ["cfpb", "fhfa", "rule", "enforcement"]),
    ("Policy", ["fed", "federal reserve", "interest rate", "monetary"]),
    ("Lenders", ["mortgage lenders", "lender"]),
    ("Guidelines", ["fannie", "freddie", "gse"]),
    ("Market", ["rates", "sales", "affordability", "mba"]),
    ("Tech", ["ai", "automation", "fraud"]),
    ("Competitors", ["rocket", "uwm", "loandepot", "sofi"]),
]


def classify_cluster(title: str, snippet: str) -> str:
    text = (title + " " + snippet).lower()
    for name, kws in CLUSTERS:
        if any(k in text for k in kws):
            return name
    return "Market"


# ======================================================
# DATA MODEL
# ======================================================
@dataclass
class NewsItem:
    title: str
    link: str
    domain: str
    published: datetime
    snippet: str
    cluster: str


# ======================================================
# MAIN RUNNER
# ======================================================
def run_industry_current_affairs(user_prompt: str) -> Tuple[str, List[Dict[str, Any]]]:

    # 1. Scope check
    if not is_industry_specific_question(user_prompt):
        return (
            "This module answers mortgage and housing industry current affairs only.",
            [],
        )

    # 2. Timeline
    window_days = extract_days(user_prompt)
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    time_hint = {7: "this week", 14: "last two weeks", 30: "this month"}[window_days]

    # 3. MULTI-QUERY NEWS SEARCH (REAL FIX)
    raw_results: List[Dict[str, Any]] = []
    for topic in NEWS_TOPIC_EXPANSIONS:
        q = f"{topic} {time_hint} news mortgage housing United States"
        raw_results.extend(
            serper_search(q, num_results=SERPER_RESULTS_PER_QUERY)
        )

    if not raw_results:
        return (
            f"No mortgage-industry news found in the last {window_days} days.",
            [],
        )

    # 4. Candidate filtering
    candidates = []
    for r in raw_results:
        link = r.get("link")
        if not link:
            continue

        domain = _domain_from_url(link)
        if _is_denied(domain):
            continue

        candidates.append(
            {
                "title": r.get("title", "Untitled"),
                "link": link,
                "snippet": r.get("snippet", ""),
                "domain": domain,
            }
        )

    candidates = candidates[:MAX_FETCH_CANDIDATES]

    # 5. Parallel publish-date verification
    pub_map: Dict[str, datetime] = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fetch_published_date, c["link"]): c for c in candidates}
        for fut in as_completed(futures):
            dt = fut.result()
            if dt:
                pub_map[futures[fut]["link"]] = dt

    # 6. STRICT recency enforcement
    items: List[NewsItem] = []
    for c in candidates:
        pub = pub_map.get(c["link"])
        if not pub or pub < cutoff:
            continue

        items.append(
            NewsItem(
                title=c["title"],
                link=c["link"],
                domain=c["domain"],
                published=pub,
                snippet=c["snippet"],
                cluster=classify_cluster(c["title"], c["snippet"]),
            )
        )

    if len(items) < MIN_NEWS_ITEMS:
        return (
            f"Not enough verified mortgage-industry news in the last "
            f"{window_days} days to answer this prompt reliably.",
            [],
        )

    # 7. Sort by quality + recency
    items.sort(
        key=lambda x: (
            any(d in x.domain for d in PREFERRED_NEWS_DOMAINS),
            x.published,
        ),
        reverse=True,
    )
    items = items[:MAX_ITEMS_FOR_LLM]

    # 8. LLM PROMPT (NO COP-OUTS)
    context = "\n".join(
        f"[{i.published.date()}] ({i.cluster}) {i.title} — {i.snippet}"
        for i in items
    )

    llm_prompt = f"""
You are a financial journalist covering the U.S. mortgage industry.

TASK:
Write a CURRENT AFFAIRS brief using ONLY the news below.

RULES:
- Do NOT say "no major developments"
- Do NOT speculate
- Summarize what IS reported
- Group related items (rates, sales, policy, lenders)
- Write factual, news-style bullets

NEWS ARTICLES:
{context}
"""

    report = call_llm(user_prompt=llm_prompt).strip()

    # 9. Sources
    sources = [
        {
            "title": i.title,
            "url": i.link,
            "domain": i.domain,
            "published": i.published.isoformat(),
            "cluster": i.cluster,
        }
        for i in items
    ]

    return report, sources
