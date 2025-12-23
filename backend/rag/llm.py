from __future__ import annotations

import json
import os
from typing import Optional

import vertexai  # type: ignore
from vertexai.generative_models import GenerativeModel  # type: ignore

from config import settings

_vertex_initialized = False
_project_id: Optional[str] = None


def _init_vertex_from_service_account() -> None:
    """
    Initialize Vertex AI by:
    - reading project_id from the service account JSON file
    - setting GOOGLE_APPLICATION_CREDENTIALS automatically
    """
    global _vertex_initialized, _project_id

    if _vertex_initialized:
        return

    sa_path = getattr(settings, "GEMINI_SERVICE_ACCOUNT_JSON_PATH", None)
    if not sa_path:
        raise RuntimeError("GEMINI_SERVICE_ACCOUNT_JSON_PATH is not set")

    if not os.path.exists(sa_path):
        raise RuntimeError(f"Service account JSON not found at: {sa_path}")

    # Load JSON
    with open(sa_path, "r", encoding="utf-8") as f:
        sa_data = json.load(f)

    project_id = sa_data.get("project_id")
    if not project_id:
        raise RuntimeError("project_id not found in service account JSON")

    _project_id = project_id

    # Let Google SDKs discover credentials automatically
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = sa_path

    location = getattr(settings, "VERTEX_LOCATION", None) or "us-central1"

    vertexai.init(project=project_id, location=location)
    _vertex_initialized = True


def call_llm(
    *,
    user_prompt: str,
    system_prompt: Optional[str] = None,
    context: Optional[str] = None,
    model_name: Optional[str] = None,
) -> str:
    _init_vertex_from_service_account()

    model = GenerativeModel(model_name or "gemini-2.5-flash")

    parts = []
    if system_prompt:
        parts.append(f"System:\n{system_prompt}")
    if context:
        parts.append(f"Context:\n{context}")
    parts.append(f"User:\n{user_prompt}")

    prompt = "\n\n".join(parts)

    response = model.generate_content(prompt)
    return (getattr(response, "text", None) or "").strip() or "I don't know."
