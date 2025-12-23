from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from config import settings
from .embeddings import embed_text
from .pinecone_client import _get_pc  # reuse same Pinecone client


def _slug_default() -> str:
    # Pinecone index names are typically lowercase with hyphens. We'll default to mortgage-tutor.
    name = (settings.PINECONE_MORTGAGE_INDEX_NAME or "mortgage-tutor").strip()
    return name


def get_mortgage_index():
    name = _slug_default()
    host = (settings.PINECONE_MORTGAGE_HOST or "").strip()
    pc = _get_pc()
    return pc.Index(name, host=host) if host else pc.Index(name)


def ensure_mortgage_index(*, dimension: int, metric: str = "cosine") -> None:
    """Best-effort create the mortgage index if it does not exist.

    Pinecone requires a 'spec' for serverless creation. We try to infer from env:
    - PINECONE_CLOUD (e.g. aws/gcp/azure)
    - PINECONE_REGION (e.g. us-east-1)
    If missing, we fall back to attempting creation without spec (may fail on some accounts).
    """
    pc = _get_pc()
    name = _slug_default()

    try:
        existing = {i.get('name') if isinstance(i, dict) else getattr(i, 'name', None) for i in pc.list_indexes()}
        if name in existing:
            return
    except Exception:
        # If list indexes fails, do not block runtime.
        return

    cloud = (settings.PINECONE_CLOUD or os.getenv("PINECONE_CLOUD") or "").strip() or None
    region = (settings.PINECONE_REGION or os.getenv("PINECONE_REGION") or os.getenv("PINECONE_ENVIRONMENT") or "").strip() or None

    try:
        # New SDK expects ServerlessSpec for serverless indexes.
        from pinecone import ServerlessSpec  # type: ignore

        spec = ServerlessSpec(cloud=cloud or "aws", region=region or "us-east-1")
        pc.create_index(name=name, dimension=dimension, metric=metric, spec=spec)
    except Exception:
        try:
            pc.create_index(name=name, dimension=dimension, metric=metric)
        except Exception:
            # Best-effort; user may have to create index + host manually and set PINECONE_MORTGAGE_HOST
            return


def _flatten_kb_obj(obj: Any, prefix: str = "") -> List[Tuple[str, str]]:
    """Return (id_suffix, text) chunks from nested JSON."""
    out: List[Tuple[str, str]] = []
    if obj is None:
        return out

    if isinstance(obj, dict):
        for k, v in obj.items():
            out.extend(_flatten_kb_obj(v, f"{prefix}{k}."))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out.extend(_flatten_kb_obj(v, f"{prefix}{i}."))
    else:
        text = str(obj).strip()
        if text:
            out.append((prefix.rstrip("."), text))
    return out


def load_kb_chunks(kb_dir: str) -> List[Dict[str, Any]]:
    """Load mortgage KB files and produce chunks suitable for vector upsert."""
    kb_path = Path(kb_dir)
    files = sorted([p for p in kb_path.glob("*.json") if p.is_file()])
    chunks: List[Dict[str, Any]] = []
    for fp in files:
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue

        # Create a small number of meaningful chunks for common structures.
        # If we recognize patterns, chunk those; else flatten.
        if isinstance(data, dict) and "glossary" in data:
            terms = (((data.get("glossary") or {}).get("terms")) or [])
            for i, t in enumerate(terms):
                if not isinstance(t, dict):
                    continue
                term = t.get("term") or ""
                definition = t.get("definition") or t.get("meaning") or ""
                text = f"Term: {term}\nDefinition: {definition}"
                chunks.append({
                    "id": f"{fp.stem}:glossary:{i}",
                    "text": text.strip(),
                    "meta": {"source": "mortgage_kb", "file": fp.name, "kind": "glossary", "term": term},
                })
        if isinstance(data, dict) and "qa_prompts" in data:
            qas = (((data.get("qa_prompts") or {}).get("qas")) or [])
            for i, qa in enumerate(qas):
                if not isinstance(qa, dict):
                    continue
                prompt = qa.get("prompt") or ""
                ans = qa.get("answer_simple") or qa.get("answer") or ""
                text = f"Q: {prompt}\nA: {ans}"
                chunks.append({
                    "id": f"{fp.stem}:qa:{i}",
                    "text": text.strip(),
                    "meta": {"source": "mortgage_kb", "file": fp.name, "kind": "qa"},
                })

        # Fallback flatten if we didn't create anything for this file
        if not any(c["meta"].get("file") == fp.name for c in chunks):
            flat = _flatten_kb_obj(data)
            # group by prefix root to avoid too many tiny chunks
            # we'll concatenate up to ~800 chars per chunk
            buf = ""
            chunk_i = 0
            for key, val in flat:
                line = f"{key}: {val}" if key else val
                if len(buf) + len(line) + 1 > 800 and buf:
                    chunks.append({
                        "id": f"{fp.stem}:flat:{chunk_i}",
                        "text": buf.strip(),
                        "meta": {"source": "mortgage_kb", "file": fp.name, "kind": "flat"},
                    })
                    chunk_i += 1
                    buf = ""
                buf += line + "\n"
            if buf.strip():
                chunks.append({
                    "id": f"{fp.stem}:flat:{chunk_i}",
                    "text": buf.strip(),
                    "meta": {"source": "mortgage_kb", "file": fp.name, "kind": "flat"},
                })
    return chunks


def upsert_kb_to_pinecone(kb_dir: str, *, namespace: Optional[str] = None) -> Dict[str, Any]:
    """Embed and upsert the KB into the mortgage Pinecone index."""
    # compute embedding dimension dynamically
    dim = len(embed_text("dimension probe"))
    if dim <= 0:
        return {"ok": False, "error": "embedding returned empty vector"}

    ensure_mortgage_index(dimension=dim, metric="cosine")
    idx = get_mortgage_index()

    chunks = load_kb_chunks(kb_dir)
    vectors: List[Tuple[str, Sequence[float], Dict[str, Any]]] = []
    for c in chunks:
        vec = embed_text(c["text"])
        if not vec:
            continue
        meta = dict(c.get("meta") or {})
        meta["text"] = c["text"]
        vectors.append((c["id"], vec, meta))

    # batch upserts
    batch = 100
    for i in range(0, len(vectors), batch):
        payload = [(vid, list(vec), meta) for (vid, vec, meta) in vectors[i:i+batch]]
        idx.upsert(vectors=payload, namespace=namespace)

    return {"ok": True, "chunks": len(chunks), "vectors": len(vectors), "dimension": dim, "index": _slug_default()}


def query_kb(query: str, *, top_k: int = 5, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
    idx = get_mortgage_index()
    qvec = embed_text(query)
    if not qvec:
        return []
    res = idx.query(vector=qvec, top_k=top_k, include_metadata=True, namespace=namespace)
    matches = getattr(res, "matches", None) or res.get("matches", [])  # type: ignore
    out: List[Dict[str, Any]] = []
    for m in matches:
        md = m.get("metadata") if isinstance(m, dict) else getattr(m, "metadata", None)
        score = m.get("score") if isinstance(m, dict) else getattr(m, "score", None)
        out.append({"score": float(score) if score is not None else None, "metadata": md or {}})
    return out
