from __future__ import annotations

from typing import List
from config import EMBEDDING_MODEL_NAME

_model = None


def _get_model():
    global _model
    if _model is not None:
        return _model

    from sentence_transformers import SentenceTransformer  # type: ignore
    _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    model = _get_model()
    vecs = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return [v.tolist() for v in vecs]


def embed_text(text: str) -> List[float]:
    return embed_texts([text])[0] if text else []


def embed_query(query: str) -> List[float]:
    return embed_text(query)
