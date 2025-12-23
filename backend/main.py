from __future__ import annotations

import inspect
import traceback
from typing import Any


from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import User
from schemas import UserCreate, UserLogin, ChatRequest, ChatResponse, WebSearchRequest
from auth_utils import hash_password, verify_password, create_access_token, get_current_user

from rag.agent import answer_question
from rag.llm import call_llm
from rag.pinecone_client import get_doc_index, get_chat_index
from rag.web_search import serper_search

import uuid
from datetime import datetime
from models import User, ChatSession, ChatMessage
from schemas import ChatSessionOut, ChatMessageOut


Base.metadata.create_all(bind=engine)

app = FastAPI(debug=True)


@app.on_event("startup")
async def _startup_mortgage_kb():
    # Best-effort: ingest Mortgage Tutor KB into a dedicated Pinecone index so it's ready when user clicks Mortgage Tutor.
    try:
        kb_dir = str((Path(__file__).resolve().parent / "mortgage_tutor_data" / "knowledge_base").resolve())
        upsert_kb_to_pinecone(kb_dir)
    except Exception:
        # Do not block API startup if Pinecone is not configured.
        pass


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def maybe_await(x: Any) -> Any:
    return await x if inspect.isawaitable(x) else x


# ---------- AUTH ----------

@app.post("/api/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = User(
        email=user.email,
        name=user.name or "",
        hashed_password=hash_password(user.password),
        role=user.role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "email": db_user.email, "name": db_user.name, "role": db_user.role}


@app.post("/api/auth/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    token = create_access_token({"sub": str(db_user.id)})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "name": current_user.name, "role": current_user.role}

@app.get("/api/chat/sessions", response_model=list[ChatSessionOut])
def list_chat_sessions(db: Session = Depends(get_db)):
    user_id = "anonymous"
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
        .all()
    )
    return [
        ChatSessionOut(
            id=s.id,
            title=s.title,
            preview=s.preview or "",
            updated_at=s.updated_at.isoformat() if s.updated_at else None,
        )
        for s in sessions
    ]

@app.get("/api/chat/sessions/{session_id}", response_model=list[ChatMessageOut])
def get_chat_session_messages(session_id: str, db: Session = Depends(get_db)):
    user_id = "anonymous"
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(400)
        .all()
    )
    return [
        ChatMessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
        for m in msgs
    ]

# ---------- CHAT (no-auth for testing) ----------

@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    try:
        prompt = payload.prompt()
        if not prompt:
            raise HTTPException(status_code=422, detail="Missing 'query' (or 'message') in request body.")

        session_id = payload.chat_session_id or str(uuid.uuid4())
        user_id = "anonymous"

        session: ChatSession | None = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        generate_title = False
        if session is None:
            session = ChatSession(id=session_id, user_id=user_id, title="New chat", preview="", updated_at=datetime.utcnow())
            db.add(session)
            db.commit()
            generate_title = True
        elif (session.title or "").strip().lower() in ("", "new chat", "new"):
            generate_title = True

        scope_map = {"internal": "internal", "web": "web", "hybrid": "hybrid"}
        scope = scope_map.get(payload.scope, "hybrid")

        result = await maybe_await(
            answer_question(
                user_prompt=prompt,
                agent=payload.agent,
                scope=scope,
                strict_citations=payload.strict_citations,
                user_id=user_id,
                chat_session_id=session_id,
                generate_session_title=generate_title,
            )
        )

        db.add(ChatMessage(id=str(uuid.uuid4()), session_id=session_id, user_id=user_id, role="user", content=prompt))
        db.add(ChatMessage(id=str(uuid.uuid4()), session_id=session_id, user_id=user_id, role="assistant", content=result.get("answer", "")))

        session.preview = (result.get("answer") or "")[:120]
        session.updated_at = datetime.utcnow()
        if generate_title and result.get("session_title"):
            session.title = str(result.get("session_title")).strip()[:60] or session.title
        db.add(session)
        db.commit()

        return ChatResponse(
            answer=result.get("answer", ""),
            sources=result.get("sources", []),
            follow_up_questions=result.get("follow_ups", []),
            chat_session_id=session_id,
            chat_session_title=session.title,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{e}\n{traceback.format_exc()}")

# ---------- SERPER endpoints ----------

@app.get("/api/test/serper")
def test_serper(q: str = "latest AI news", num_results: int = 5):
    """Swagger-friendly Serper test."""
    try:
        results = serper_search(q, num_results=num_results)
        return {"ok": True, "query": q, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Serper error: {e}\n{traceback.format_exc()}")


@app.post("/api/websearch")
def websearch(req: WebSearchRequest):
    """POST endpoint for Serper search via Swagger docs."""
    try:
        results = serper_search(req.query, num_results=req.num_results)
        return {"ok": True, "query": req.query, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Serper error: {e}\n{traceback.format_exc()}")


# ---------- TEST endpoints ----------

@app.get("/api/test/pinecone")
def test_pinecone():
    try:
        stats = get_doc_index().describe_index_stats()
        return {"ok": True, "stats": stats if isinstance(stats, dict) else str(stats)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pinecone error: {e}\n{traceback.format_exc()}")


@app.get("/api/test/chat-history")
def test_chat_history():
    try:
        stats = get_chat_index().describe_index_stats()
        return {"ok": True, "stats": stats if isinstance(stats, dict) else str(stats)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pinecone error: {e}\n{traceback.format_exc()}")


@app.get("/api/test/llm")
async def test_llm():
    try:
        text = await maybe_await(call_llm(user_prompt="Say hello in one sentence."))
        return {"ok": True, "answer": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}\n{traceback.format_exc()}")


@app.get("/api/test/rag")
async def test_rag(q: str = "What is stored in the vector database?"):
    """End-to-end RAG test (Pinecone retrieval + Serper optional + LLM)."""
    try:
        result = await maybe_await(
            answer_question(
                user_prompt=q,
                agent="default",
                scope="all",
                strict_citations=False,
                user_id="debug",
                chat_session_id="debug-session",
            )
        )
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG error: {e}\n{traceback.format_exc()}")
