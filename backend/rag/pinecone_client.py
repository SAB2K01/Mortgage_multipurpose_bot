from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

from pinecone import Pinecone  # new SDK (do NOT import Index)
from config import settings

_pc: Any = None
_doc_index: Any = None
_chat_index: Any = None


def _require(val: Optional[str], name: str) -> str:
    v = (val or "").strip()
    if not v:
        raise RuntimeError(f"Missing required setting: {name}")
    return v


def _get_pc() -> Any:
    global _pc
    if _pc is not None:
        return _pc
    api_key = _require(settings.PINECONE_API_KEY, "PINECONE_API_KEY")
    _pc = Pinecone(api_key=api_key)
    return _pc


def get_doc_index():
    global _doc_index
    if _doc_index is not None:
        return _doc_index

    name = _require(settings.PINECONE_INDEX_NAME, "PINECONE_INDEX_NAME")
    host = (settings.PINECONE_HOST or "").strip()
    pc = _get_pc()
    _doc_index = pc.Index(name, host=host) if host else pc.Index(name)
    return _doc_index


def get_chat_index():
    global _chat_index
    if _chat_index is not None:
        return _chat_index

    name = (settings.PINECONE_CHAT_INDEX_NAME or "chathistory").strip()
    host = (settings.PINECONE_CHAT_HOST or settings.PINECONE_HOST or "").strip()
    pc = _get_pc()
    _chat_index = pc.Index(name, host=host) if host else pc.Index(name)
    return _chat_index


def query_docs(
    embedding: Sequence[float],
    *,
    top_k: int = 5,
    namespace: Optional[str] = None,
    metadata_filter: Optional[Dict[str, Any]] = None,
) -> Any:
    return get_doc_index().query(
        vector=list(embedding),
        top_k=top_k,
        include_metadata=True,
        namespace=namespace,
        filter=metadata_filter,
    )


def upsert_docs(
    vectors: List[Tuple[str, Sequence[float], Dict[str, Any]]],
    *,
    namespace: Optional[str] = None,
) -> Any:
    payload = [(vid, list(vec), meta) for (vid, vec, meta) in vectors]
    return get_doc_index().upsert(vectors=payload, namespace=namespace)


def upsert_chat_message(
    *,
    user_id: str,
    conversation_id: str,
    role: str,
    content: str,
    embedding: Sequence[float],
    metadata: Optional[Dict[str, Any]] = None,
) -> Any:
    ts = time.time()
    vector_id = f"{user_id}:{conversation_id}:{ts}"
    md: Dict[str, Any] = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "timestamp": ts,
    }
    if metadata and isinstance(metadata, dict):
        md.update(metadata)
    return get_chat_index().upsert(vectors=[(vector_id, list(embedding), md)])




def query_chat_history(
    embedding: Sequence[float],
    *,
    user_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    top_k: int = 20,
) -> Any:
    filt: Dict[str, Any] = {}
    if user_id:
        filt["user_id"] = {"$eq": user_id}
    if conversation_id:
        filt["conversation_id"] = {"$eq": conversation_id}

    return get_chat_index().query(
        vector=list(embedding),
        top_k=top_k,
        include_metadata=True,
        filter=filt or None,
    )
