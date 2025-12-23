# backend/rag/response_style.py
from __future__ import annotations

import re
from typing import Literal

from .llm import call_llm

ViewMode = Literal["short", "detailed"]

SHORT_TRIGGERS = [
    "short view", "shortview", "short", "brief", "tl;dr", "tldr",
    "quick view", "quick summary", "one-liner", "in points"
]
DETAILED_TRIGGERS = [
    "detailed", "detail", "deep dive", "explain", "break down",
    "full", "in depth", "in-depth", "elaborate"
]


def resolve_view_mode(user_prompt: str) -> ViewMode:
    p = (user_prompt or "").lower()
    # detailed wins if both appear
    if any(t in p for t in DETAILED_TRIGGERS):
        return "detailed"
    # default is short (even if user doesn't say "short")
    return "short"


def sentence_count(text: str) -> int:
    # simple sentence split; good enough for enforcing budget
    parts = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    parts = [p.strip() for p in parts if p and re.search(r"[A-Za-z0-9]", p)]
    return len(parts)


def enforce_sentence_budget(
    *,
    answer: str,
    user_prompt: str,
    mode: ViewMode,
    max_rewrites: int = 2,
) -> str:
    """
    Enforce:
      - short: 4–5 sentences
      - detailed: >= 10 sentences
    Uses LLM rewrite if needed.
    """
    if not answer:
        return answer

    def ok(a: str) -> bool:
        n = sentence_count(a)
        if mode == "short":
            return 4 <= n <= 5
        return n >= 10

    if ok(answer):
        return answer

    target = "4 to 5 sentences total" if mode == "short" else "at least 10 sentences"
    style = (
        "Keep it crisp, no bullet lists, no headings, no citations/URLs. "
        "Only include important details."
        if mode == "short"
        else
        "Explain clearly with practical detail. Still avoid citations/URLs. "
        "Use complete sentences; no bullet lists."
    )

    rewrite_prompt = f"""
Rewrite the assistant answer to match this rule: {target}.
{style}

User prompt:
{user_prompt}

Assistant answer to rewrite:
{answer}
""".strip()

    out = answer
    for _ in range(max_rewrites):
        out = call_llm(user_prompt=rewrite_prompt)
        if ok(out):
            return out
        # tighten instruction on retries
        rewrite_prompt = f"""
Your last rewrite did not meet the sentence requirement.
Rewrite again with EXACTLY {target}.
No bullets. No headings. No URLs. No citations.

User prompt:
{user_prompt}

Assistant answer to rewrite:
{out}
""".strip()

    # return best effort even if still not perfect
    return out
