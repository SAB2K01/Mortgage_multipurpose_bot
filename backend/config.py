from __future__ import annotations

from typing import Any, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Hackothan Backend"
    DEBUG: bool = True

    # DB
    DATABASE_URL: str = "sqlite:///./users.db"

    # Auth
    JWT_SECRET_KEY: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24

    # Embeddings
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Pinecone (new SDK)
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_HOST: Optional[str] = None
    PINECONE_INDEX_NAME: Optional[str] = None
    PINECONE_CHAT_INDEX_NAME: str = "chathistory"
    PINECONE_CHAT_HOST: Optional[str] = None

    # Mortgage Tutor index (optional separate KB index)
    PINECONE_MORTGAGE_INDEX_NAME: str = "mortgage-tutor"
    PINECONE_MORTGAGE_HOST: Optional[str] = None
    PINECONE_CLOUD: Optional[str] = None
    PINECONE_REGION: Optional[str] = None


    # Serper (Google Search API)
    SERPER_API_KEY: Optional[str] = None
    SERPER_GL: str = "in"  # country code
    SERPER_HL: str = "en"  # language

    # LLM model (✅ your request)
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # API-key Gemini mode
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None

    # Vertex mode (service account)
    GEMINI_SERVICE_ACCOUNT_JSON: Optional[Any] = None
    GEMINI_SERVICE_ACCOUNT_JSON_PATH: Optional[str] = None
    VERTEX_PROJECT: Optional[str] = None
    VERTEX_LOCATION: str = "us-central1"


settings = Settings()
EMBEDDING_MODEL_NAME = settings.EMBEDDING_MODEL_NAME
