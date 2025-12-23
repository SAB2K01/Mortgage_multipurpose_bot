from typing import List, Dict, Any
from rag.embeddings import embed_query
from rag.pinecone_client import index


def query_index(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Query the Pinecone index using a text query.
    Returns a list of matches (each with metadata + score).
    Compatible with the new `pinecone` client.
    """
    # Get embedding from your embedding model
    vector = embed_query(query)

    # Query Pinecone
    res = index.query(
        vector=vector,
        top_k=top_k,
        include_metadata=True,
    )

    # New client: `res.matches` is a list-like
    matches = getattr(res, "matches", None)
    if matches is None and isinstance(res, dict):
        # Fallback if response is dict-like
        matches = res.get("matches", [])

    return matches or []
