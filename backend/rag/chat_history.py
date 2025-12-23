import time
from typing import Optional, Dict, Any, List

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_API_KEY
from rag.embeddings import embed_texts
from rag.pinecone_client import chat_index

from rag.embeddings import embed_text
from rag.pinecone_client import chat_index

def save_chat(user_id, user_message, bot_reply):
    try:
        emb = embed_text(user_message)
        chat_index.upsert(vectors=[
            {
                "id": f"{user_id}-{hash(user_message)}",
                "values": emb,
                "metadata": {"user": user_id, "query": user_message, "reply": bot_reply},
            }
        ])
    except Exception as e:
        logger.error(f"Error saving chat: {e}")


_supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_API_KEY:
    _supabase = create_client(SUPABASE_URL, SUPABASE_API_KEY)


def _now_ms() -> int:
    return int(time.time() * 1000)


def log_chat_turn(
    user_id: Optional[str],
    question: str,
    answer: str,
    scope: str,
    agent: str,
    sources: List[Dict[str, Any]],
) -> None:
    """
    Store the Q/A pair in:
      - Pinecone 'chathistory' index (for semantic retrieval later)
      - Supabase table 'chat_messages' (optional, for backup / analytics)
    """
    try:
        # ---- Pinecone embedding and upsert ----
        texts = [f"Q: {question}\nA: {answer}"]
        vectors = embed_texts(texts)  # returns List[List[float]] length 1024

        metadata = {
            "user_id": user_id or "anonymous",
            "scope": scope,
            "agent": agent,
            "question": question,
            "answer": answer,
            "source_count": len(sources),
            "timestamp_ms": _now_ms(),
        }

        # One vector per chat turn
        chat_index.upsert(
            vectors=[
                {
                    "id": f"{metadata['user_id']}-{metadata['timestamp_ms']}",
                    "values": vectors[0],
                    "metadata": metadata,
                }
            ]
        )
    except Exception as e:
        # Don't crash the request just because logging failed
        print(f"[chat_history] Pinecone logging failed: {e}")

    # ---- Supabase backup (optional) ----
    if _supabase is not None:
        try:
            _supabase.table("chat_messages").insert(
                {
                    "user_id": user_id,
                    "question": question,
                    "answer": answer,
                    "scope": scope,
                    "agent": agent,
                    "source_count": len(sources),
                }
            ).execute()
        except Exception as e:
            print(f"[chat_history] Supabase logging failed: {e}")
