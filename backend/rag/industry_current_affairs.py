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
SERPER_RESULTS_PER_QUERY = 20
MAX_FETCH_CANDIDATES = 40
MAX_ITEMS_FOR_LLM = 30

ALLOWED_WINDOWS = {7, 14, 30}
DEFAULT_WINDOW_DAYS = 30
MIN_NEWS_ITEMS = 10
TIMEOUT_SECS = 10


# ======================================================
# QUERY EXPANSION  (UNCHANGED)
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
    "fannie mae",
    "freddie mac",
    "cfpb regulations",
    "fhfa updates",
    "mortgage technology",
    "housing trends",
    "real estate news",
    "mortgage lending",
    "fannie and freddie",
    "mortgage market trends",
    "housing industry trends",
    "mortgage rate changes",
    "interest rate hikes",
    "housing market news",
    "mortgage refinancing",
    "refinancing trends",
    "refi trends",
    "mortgage industry analysis",
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


# ======================================================
# PREFERRED / DENIED DOMAINS (UNCHANGED)
# ======================================================
PREFERRED_NEWS_DOMAINS = [
    "apnews.com",
    "nytimes.com",
    "washingtonpost.com",
    "wsj.com",
    "bloomberg.com",
    "reuters.com",
    "bankrate.com",
    "thehill.com",
    "politico.com",
    "nbcnews.com",
    "cbsnews.com",
    "abcnews.go.com",
    "usatoday.com",
    "cnbc.com",
    "forbes.com",
    "marketwatch.com",
    "cnn.com",
    "bbc.com",
    "theguardian.com",
    "ft.com",
    "economist.com",
    "barrons.com",
    "financialtimes.com",
    "businessinsider.com",
    "foxnews.com",
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
# INDUSTRY GATING (UNCHANGED)
# ======================================================
INDUSTRY_CONTEXT_TERMS = [
    "mortgage",
    "feds",
    "federal reserve",
    "interest rates",
    "refinance",
    "refi",
    "fannie mae",
    "freddie mac",
    "gse",
    "ginnie mae",
    "fha loan",
    "va loan",
    "usda loan",
    "conforming loan limit",
    "jumbo loan",
    "underwriting",
    "origination",
    "servicing",
    "loss mitigation",
    "forbearance",
    "foreclosure",
    "mortgage loan",
    "loan estimate",
    "closing disclosure",
    "trid",
    "interest rate",
    "tila",
    "respa",
    "hmda",
    "escrow",
    "pmi",
    "mip",
    "llpa",
    "dti",
    "ltv",
    "fico",
    "mortgage industry",
    "housing industry",
    "housing market",
    "mortgage trends",
    "refinancing",
    "mortgage-backed securities",
    "mba",
    "mortgage market",
    "rates",
    "housing trends",
    "real estate trends",
    "housing market trends",
    "home prices",
    "home sales",
    "housing affordability",
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


def is_industry_specific_question(prompt: str) -> bool:
    p = (prompt or "").lower()
    return any(t in p for t in INDUSTRY_CONTEXT_TERMS)


# ======================================================
# CONSUMER INTENT DETECTION (NEW)
# ======================================================
CONSUMER_INTENT_TERMS = [
    "is now a good time",
    "good time to refinance",
    "should i",
    "should we",
    "is it worth",
    "for me",
    "my mortgage",
    "my loan",
]


def is_consumer_intent(prompt: str) -> bool:
    p = (prompt or "").lower()
    return any(t in p for t in CONSUMER_INTENT_TERMS)


# ======================================================
# TIMELINE
# ======================================================
def extract_days(prompt: str) -> int:
    if not prompt:
        return DEFAULT_WINDOW_DAYS

    m = re.search(r"last\s+(\d+)\s+days", prompt, re.I)
    if m:
        d = int(m.group(1))
        if d in ALLOWED_WINDOWS:
            return d

    if re.search(r"\bweek\b", prompt, re.I):
        return 7
    if re.search(r"\bmonth\b", prompt, re.I):
        return 30

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
def try_parse_date(s: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(s.replace("Z", "")).replace(tzinfo=timezone.utc)
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
        if meta.get("property") in {
            "article:published_time",
            "og:published_time",
            "article:modified_time",
        }:
            dt = try_parse_date(meta.get("content"))
            if dt:
                return dt

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.text)
            if isinstance(data, dict):
                for k in ("datePublished", "dateModified"):
                    if k in data:
                        dt = try_parse_date(data[k])
                        if dt:
                            return dt
        except Exception:
            continue

    return None


# ======================================================
# CLUSTERING (UNCHANGED)
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
    ("Guidelines", ["fannie", "freddie", "gse"]),
    ("Market", ["rates", "sales", "affordability", "mba"]),
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
    id: int
    title: str
    link: str
    domain: str
    published: datetime
    snippet: str
    cluster: str


def freshness_score(item: NewsItem) -> int:
    score = 0
    if item.domain in PREFERRED_NEWS_DOMAINS:
        score += 2
    age = (datetime.now(timezone.utc) - item.published).days
    if age <= 7:
        score += 2
    elif age <= 30:
        score += 1
    return score


# ======================================================
# MAIN RUNNER
# ======================================================
def run_industry_current_affairs(user_prompt: str) -> Tuple[str, List[Dict[str, Any]]]:

    if not is_industry_specific_question(user_prompt):
        return (
            "This agent answers U.S. mortgage and housing industry current affairs only.",
            [],
        )

    consumer_intent = is_consumer_intent(user_prompt)

    window_days = extract_days(user_prompt)
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

    tbs = "qdr:w" if window_days <= 7 else "qdr:m"

    # ---------------- SEARCH ----------------
    raw_results: List[Dict[str, Any]] = []
    for topic in NEWS_TOPIC_EXPANSIONS:
        q = f"{topic} mortgage housing United States"
        raw_results.extend(
            serper_search(q, num_results=SERPER_RESULTS_PER_QUERY, tbs=tbs)
        )

    # ---------------- FILTER ----------------
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
                "date": try_parse_date(r.get("date", "")),
            }
        )

    candidates = candidates[:MAX_FETCH_CANDIDATES]

    # ---------------- DATE ENRICHMENT ----------------
    pub_map: Dict[str, datetime] = {}
    to_fetch = [c for c in candidates if not c["date"]]

    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {
            ex.submit(fetch_published_date, c["link"]): c for c in to_fetch
        }
        for fut in as_completed(futures):
            dt = fut.result()
            if dt:
                pub_map[futures[fut]["link"]] = dt

    # ---------------- BUILD ITEMS ----------------
    items: List[NewsItem] = []
    for idx, c in enumerate(candidates, start=1):
        pub = c["date"] or pub_map.get(c["link"]) or datetime.now(timezone.utc)
        if pub < cutoff:
            continue

        items.append(
            NewsItem(
                id=idx,
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
            f"Insufficient recent mortgage industry news in the last {window_days} days.",
            [],
        )

    items.sort(key=lambda x: (freshness_score(x), x.published), reverse=True)
    items = items[:MAX_ITEMS_FOR_LLM]

    # ---------------- CONTEXT WITH CITATIONS ----------------
    context = "\n".join(
        f"[{i.id}] ({i.published.date()} | {i.domain} | {i.cluster}) "
        f"{i.title} — {i.snippet}"
        for i in items
    )

    # ---------------- HARD-LOCKED PROMPT ----------------
    llm_prompt = f"""
You are a professional financial journalist covering the U.S. mortgage and housing industry.

IMPORTANT CONTEXT:
The news below is VERIFIED, RECENT, and CURRENT.

ABSOLUTE RULES:
- Use ONLY the news provided.
- Cite every factual statement using square brackets like [1].
- DO NOT speculate.
- DO NOT give personal or financial advice.
- DO NOT say whether something is "good" or "bad" for an individual.
- DO NOT write disclaimers or meta commentary.

TASK:
{"Reframe the user's question as industry-level reporting about refinancing conditions."
 if consumer_intent else
 "Write a current-affairs brief summarizing recent mortgage and housing industry developments."}

FORMAT:
- Bullet points only
- Every bullet MUST include at least one citation

NEWS ARTICLES:
{context}
"""

    report = call_llm(user_prompt=llm_prompt).strip()

    if "[" not in report:
        report = call_llm(
            user_prompt=llm_prompt + "\nREMINDER: Every bullet must include citations like [1]."
        ).strip()

    # ---------------- SOURCES SIDE PANEL ----------------
    sources = [
        {
            "id": i.id,
            "title": i.title,
            "url": i.link,
            "domain": i.domain,
            "published": i.published.isoformat(),
            "cluster": i.cluster,
        }
        for i in items
    ]

    return report, sources
