from __future__ import annotations

import asyncio
import inspect
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .embeddings import embed_text
from .industry_current_affairs import run_industry_current_affairs
from .llm import call_llm
from .pinecone_client import query_chat_history, query_docs, upsert_chat_message
from .response_style import enforce_sentence_budget, resolve_view_mode
from .web_search import web_search
from .mortgage_pinecone import upsert_kb_to_pinecone, query_kb

try:
    from mortgage_tutor.agent import MortgageTutorAgent  # type: ignore
except Exception:  # pragma: no cover
    MortgageTutorAgent = None  # type: ignore


_mortgage_agent = None
_mortgage_kb_ready = False

# -----------------------
# Mortgage-industry-only gating (STRICT ENOUGH)
# -----------------------
MORTGAGE_ONLY_GATING = True

# Keep this list "mortgage-industry specific" (avoid generic words like "pricing", "yield", "rate").
_MORTGAGE_TERMS = [
    "mortgage",
    "home loan",
    "refinance",
    "cash-out refinance",
    "heloc",
    "fhfa",
    "gse",
    "fannie",
    "freddie",
    "ginnie",
    "gnma",
    "fha",
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
    "mbs",
    "mortgage-backed",
    "loan estimate",
    "closing disclosure",
    "trid",
    "tila",
    "respa",
    "hmda",
    "cfpb",
    "escrow",
    "pmi",
    "mip",
    "llpa",
    "dti",
    "ltv",
    "fico",
]

def _compile_phrase(p: str) -> re.Pattern[str]:
    phrase = re.escape(p.strip()).replace(r"\ ", r"\s+")
    return re.compile(rf"(?i)\b{phrase}\b")

_MORTGAGE_RX = [_compile_phrase(t) for t in _MORTGAGE_TERMS if t.strip()]

def _is_mortgage_industry_prompt(prompt: str) -> bool:
    p = prompt or ""
    return any(rx.search(p) for rx in _MORTGAGE_RX)


# -----------------------
# Async helpers
# -----------------------
async def maybe_await(x: Any) -> Any:
    return await x if inspect.isawaitable(x) else x


# -----------------------
# Result helpers
# -----------------------
def _extract_matches(res: Any) -> List[Any]:
    """
    Pinecone SDK responses vary. We normalize to a list of matches.
    """
    if res is None:
        return []
    if isinstance(res, dict):
        return res.get("matches") or []
    return getattr(res, "matches", []) or []


def _safe_str(x: Any) -> str:
    return "" if x is None else str(x)


def _domain_from_url(url: str) -> str:
    m = re.search(r"https?://([^/]+)/?", url or "")
    return m.group(1) if m else (url or "")


def _match_to_frontend_source(m: Any, kind: str) -> Dict[str, Any]:
    """
    Convert a Pinecone match object/dict into the frontend "sources" shape.
    """
    if isinstance(m, dict):
        md = m.get("metadata") or {}
        mid = m.get("id")
        score = m.get("score")
    else:
        md = getattr(m, "metadata", None) or {}
        mid = getattr(m, "id", None)
        score = getattr(m, "score", None)

    md = md if isinstance(md, dict) else {}

    title = md.get("title") or md.get("document_title") or md.get("filename") or kind.upper()
    section = md.get("section") or md.get("heading") or md.get("chunk_id") or ""
    src = md.get("source") or md.get("path") or kind

    text = md.get("text") or md.get("content") or md.get("chunk") or md.get("page_content") or ""
    snippet = md.get("snippet") or (text[:220] if text else "")

    access_level = md.get("accessLevel") or md.get("access_level") or ("internal" if kind != "web" else "public")
    access_level = "public" if str(access_level).lower() == "public" else "internal"

    safe_id = _safe_str(mid).strip()
    if not safe_id:
        safe_id = f"{kind}:{abs(hash((title, src, snippet)))}"

    return {
        "id": safe_id,
        "title": _safe_str(title) or kind.upper(),
        "section": _safe_str(section),
        "source": _safe_str(src),
        "accessLevel": access_level,
        "snippet": _safe_str(snippet),
        "fullText": _safe_str(text),
        "kind": kind,
        "score": score,
    }


def _web_item_to_frontend_source(item: Dict[str, Any], i: int) -> Dict[str, Any]:
    """
    Convert a web_search result dict into the frontend "sources" shape.
    """
    url = _safe_str(item.get("link") or item.get("url")).strip()
    title = _safe_str(item.get("title") or "Web result")
    snippet = _safe_str(item.get("snippet") or "")
    domain = _domain_from_url(url) if url else "web"

    return {
        "id": url or f"web:{i}:{abs(hash((title, snippet)))}",
        "title": title,
        "section": domain,
        "source": url or "web",
        "accessLevel": "public",
        "snippet": snippet[:240],
        "fullText": snippet,
        "kind": "web",
        "score": None,
    }


def _dedupe_and_sort_sources(sources: List[Dict[str, Any]], max_sources: int = 6) -> List[Dict[str, Any]]:
    """
    Dedupe sources + prioritize internal (pinecone/chat) over web.
    """
    seen = set()
    out: List[Dict[str, Any]] = []
    for s in sources:
        key = (
            (s.get("kind") or "").lower(),
            s.get("source") or "",
            s.get("section") or "",
            (s.get("snippet") or "")[:120],
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(s)

    def rank(s: Dict[str, Any]) -> Tuple[int, float]:
        kind = (s.get("kind") or "").lower()
        pri = 0 if kind in ("pinecone", "chathistory") else 1
        score = s.get("score")
        try:
            sc = float(score) if score is not None else -1.0
        except Exception:
            sc = -1.0
        return (pri, -sc)

    out.sort(key=rank)
    return out[:max_sources]


def _build_context(sources: List[Dict[str, Any]], max_chars: int = 3500) -> str:
    """
    Concatenate source texts into a compact context string for the LLM.
    """
    chunks: List[str] = []
    total = 0
    for s in sources:
        text = (s.get("fullText") or s.get("snippet") or "").strip()
        if not text:
            continue
        if total + len(text) > max_chars:
            text = text[: max(0, max_chars - total)]
        chunks.append(text)
        total += len(text)
        if total >= max_chars:
            break
    return "\n\n---\n\n".join(chunks).strip()


def _parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    """
    Robust-ish JSON extraction (sometimes LLM wraps JSON in text).
    """
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


# -----------------------
# Main entry
# -----------------------
async def answer_question(
    *,
    user_prompt: str,
    agent: str = "default",          # knowledge | mortgage | industry | etc.
    scope: str = "hybrid",           # internal | web | hybrid
    strict_citations: bool = False,  # frontend may pass; we don't embed citations in answer
    user_id: Optional[str] = None,
    chat_session_id: Optional[str] = None,
    generate_session_title: bool = False,
) -> Dict[str, Any]:
    user_id = user_id or "anonymous"
    chat_session_id = chat_session_id or "default"

    agent_id = (agent or "default").strip().lower()
    mode = resolve_view_mode(user_prompt)

    # ------------------------------------------------------------
    # Mortgage-industry-only guard: refuse early if not mortgage-related
    # (NO LLM fallback; prevents "Virat Kohli" from slipping through)
    # ------------------------------------------------------------
    if MORTGAGE_ONLY_GATING and not _is_mortgage_industry_prompt(user_prompt):
        refusal = "I don't know."
        refusal = await asyncio.to_thread(
            enforce_sentence_budget,
            answer=refusal,
            user_prompt=user_prompt,
            mode=mode,
        )
        return {
            "answer": refusal,
            "sources": [],
            "follow_ups": [
                "ask a mortgage industry question",
                "try: mortgage rates, FHFA/GSE updates, underwriting, servicing, TRID/HMDA, MBS",
            ],
            "meta": {"agent": agent_id, "gated": True},
        }

    # ------------------------------------------------------------
    # Mortgage Tutor
    # ------------------------------------------------------------
    if agent_id in ("mortgage", "mortgage_tutor", "mortgage-agent"):
        global _mortgage_agent, _mortgage_kb_ready

        if _mortgage_agent is None:
            if MortgageTutorAgent is None:
                raise RuntimeError("MortgageTutorAgent package not available. Check backend/mortgage_tutor packaging.")
            _mortgage_agent = MortgageTutorAgent()

        if not _mortgage_kb_ready:
            kb_dir = str((Path(__file__).resolve().parent.parent / "mortgage_tutor_data" / "knowledge_base").resolve())
            try:
                upsert_kb_to_pinecone(kb_dir)
                _mortgage_kb_ready = True
            except Exception:
                _mortgage_kb_ready = False

        kb_sources: List[Dict[str, Any]] = []
        try:
            matches = query_kb(user_prompt, top_k=5)
            for i, m in enumerate(matches):
                md = (m.get("metadata") or {})
                if md:
                    kb_sources.append({
                        "id": md.get("file") or f"mortgage_kb_{i}",
                        "title": md.get("term") or md.get("file") or "Mortgage KB",
                        "section": md.get("kind") or "kb",
                        "source": md.get("source") or "mortgage_kb",
                        "snippet": (md.get("text") or "")[:400],
                        "score": m.get("score"),
                        "url": None,
                    })
        except Exception:
            kb_sources = []

        resp = await asyncio.to_thread(
            _mortgage_agent.handle,
            user_id=user_id,
            text=user_prompt,
            scenario=None,
            mode=None,
            scope=scope if scope in ("internal", "web", "hybrid") else "internal",
            strict_citations=strict_citations,
            rewrite_with_llm=True,
        )

        answer = (resp or {}).get("output") or (resp or {}).get("answer") or ""
        answer = await asyncio.to_thread(
            enforce_sentence_budget,
            answer=answer,
            user_prompt=user_prompt,
            mode=mode,
        )

        return {
            "answer": answer,
            "sources": kb_sources,
            "meta": (resp or {}).get("meta") or {"agent": "mortgage"},
        }

    # ------------------------------------------------------------
    # Industry Current Affairs (web-only pipeline)
    # ------------------------------------------------------------
    if agent_id in ("industry", "industry_current_affairs", "current_affairs"):
        report, web_items = await asyncio.to_thread(run_industry_current_affairs, user_prompt)

        report = await asyncio.to_thread(
            enforce_sentence_budget,
            answer=report,
            user_prompt=user_prompt,
            mode=mode,
        )

        sources: List[Dict[str, Any]] = []
        for i, item in enumerate((web_items or [])[:10]):
            if isinstance(item, dict):
                sources.append(_web_item_to_frontend_source(item, i))

        return {
            "answer": report,
            "sources": _dedupe_and_sort_sources(sources, max_sources=10),
            "follow_ups": [
                "give me a short view on this",
                "give me a detailed view on this",
                "focus only on FHFA + GSE updates",
            ],
        }

    # ------------------------------------------------------------
    # Normal RAG agents
    # ------------------------------------------------------------
    want_internal = scope in ("internal", "hybrid", "all")
    # Only enable web if scope allows AND prompt is mortgage-industry
    want_web = scope in ("web", "hybrid", "all") and _is_mortgage_industry_prompt(user_prompt)

    q_emb = await asyncio.to_thread(embed_text, user_prompt)

    async def docs_task():
        return await asyncio.to_thread(query_docs, q_emb, top_k=3)

    async def chat_task():
        return await asyncio.to_thread(
            query_chat_history,
            q_emb,
            user_id=user_id,
            conversation_id=chat_session_id,
            top_k=6,
        )

    async def web_task():
        return await maybe_await(web_search(user_prompt, num_results=5))

    docs_res, chat_res, web_res = await asyncio.gather(
        docs_task() if want_internal else asyncio.sleep(0, result=None),
        chat_task() if want_internal else asyncio.sleep(0, result=None),
        web_task() if want_web else asyncio.sleep(0, result=None),
    )

    sources: List[Dict[str, Any]] = []

    if want_internal:
        for m in _extract_matches(docs_res):
            sources.append(_match_to_frontend_source(m, "pinecone"))
        for m in _extract_matches(chat_res):
            sources.append(_match_to_frontend_source(m, "chathistory"))

    if want_web and isinstance(web_res, list):
        for i, item in enumerate(web_res[:5]):
            if isinstance(item, dict):
                sources.append(_web_item_to_frontend_source(item, i))

    sources = _dedupe_and_sort_sources(sources, max_sources=6)
    context = _build_context(sources, max_chars=3500)

    # LLM call (also enforce refusal rule at generation time)
    mortgage_policy = (
        "CRITICAL: You ONLY answer questions about the mortgage / housing finance industry. "
        "If the question is not mortgage/housing-finance, respond exactly: I don't know."
    )

    if generate_session_title:
        system_prompt = (
            mortgage_policy
            + " Return ONLY valid JSON with keys: answer (string), session_title (string). "
              "Session title should be 3-6 words."
        )
    else:
        system_prompt = mortgage_policy + " Use the provided context when relevant."

    llm_text = await maybe_await(
        call_llm(
            user_prompt=user_prompt,
            system_prompt=system_prompt,
            context=context,
        )
    )

    answer: str
    session_title: Optional[str] = None

    if generate_session_title:
        obj = _parse_json_object(llm_text)
        if obj and isinstance(obj, dict):
            answer = _safe_str(obj.get("answer")).strip() or "I don't know."
            session_title = _safe_str(obj.get("session_title") or obj.get("title")).strip() or None
        else:
            answer = _safe_str(llm_text).strip() or "I don't know."
    else:
        answer = _safe_str(llm_text).strip() or "I don't know."

    answer = await asyncio.to_thread(
        enforce_sentence_budget,
        answer=answer,
        user_prompt=user_prompt,
        mode=mode,
    )

    try:
        upsert_chat_message(
            user_id=user_id,
            conversation_id=chat_session_id,
            role="user",
            content=user_prompt,
            embedding=q_emb,
            metadata={"session_id": chat_session_id},
        )
        upsert_chat_message(
            user_id=user_id,
            conversation_id=chat_session_id,
            role="assistant",
            content=answer,
            embedding=await asyncio.to_thread(embed_text, answer),
            metadata={"session_id": chat_session_id},
        )
    except Exception:
        pass

    out: Dict[str, Any] = {
        "answer": answer,
        "sources": sources,
        "follow_ups": [
            "give me a short view on this",
            "give me a detailed view on this",
            "ask a follow-up question",
        ],
    }
    if session_title:
        out["session_title"] = session_title
    return out
