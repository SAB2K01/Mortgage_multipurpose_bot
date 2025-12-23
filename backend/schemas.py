from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "analyst"
    name: str = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str



class ChatHistoryMessage(BaseModel):
    role: str
    content: str

class ChatHistoryMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: Optional[str] = None
    message: Optional[str] = None
    agent: str = "default"
    scope: str = "hybrid"
    strict_citations: bool = False
    history: List[ChatHistoryMessage] = []
    chat_session_id: Optional[str] = None

    def prompt(self) -> str:
        return (self.query or self.message or "").strip()


class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]] = []
    follow_up_questions: List[str] = []
    chat_session_id: Optional[str] = None
    chat_session_title: Optional[str] = None

class ChatSessionOut(BaseModel):
    id: str
    title: str
    preview: str = ""
    updated_at: Optional[str] = None

class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: Optional[str] = None


class WebSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    num_results: int = 5
