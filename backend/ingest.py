from typing import List, Dict, Any
import uuid

from rag.embeddings import embed_query
from rag.pinecone_client import index


def upsert_documents(docs: List[Dict[str, Any]]) -> None:
    """
    Upsert a list of documents into Pinecone.

    Each doc should look like:
    {
        "id": "underwriting-rules",
        "title": "Underwriting Rules Engine",
        "section": "Overview",
        "text": "The underwriting rules engine is implemented in ...",
        "modified_at": "2025-12-01",
        "roles": ["analyst", "admin"]   # for access control
    }
    """

    vectors = []

    for doc in docs:
        text = doc["text"]
        vector = embed_query(text)  # reuse same embedding as queries

        metadata = {
            "doc_name": doc.get("title"),
            "section": doc.get("section"),
            "text": text,
            "modified_at": doc.get("modified_at"),
            "roles": doc.get("roles", []),
        }

        vector_id = doc.get("id") or str(uuid.uuid4())
        vectors.append((vector_id, vector, metadata))

    if not vectors:
        print("No documents to upsert.")
        return

    # Pinecone upsert
    index.upsert(vectors=vectors)
    print(f"Upserted {len(vectors)} vectors into Pinecone.")


if __name__ == "__main__":
    # 🔧 SAMPLE DOCUMENTS – replace with your real internal knowledge later
    sample_docs = [
        {
            "id": "underwriting-rules-engine",
            "title": "Underwriting Rules Engine",
            "section": "Implementation",
            "text": (
                "The underwriting rules engine is implemented as a microservice "
                "named `underwriting-service`. It runs in the core mortgage "
                "platform cluster and exposes a gRPC API for rule evaluation."
            ),
            "modified_at": "2025-12-01",
            "roles": ["analyst", "engineer", "admin"],
        },
        {
            "id": "borrower-employment-model",
            "title": "Borrower Employment Data Model",
            "section": "Latest Decision",
            "text": (
                "The latest decision on the borrower employment data model is to use "
                "a normalized schema with an `employment_history` table keyed by "
                "`borrower_id`. Each record stores employer_name, start_date, "
                "end_date, and employment_type."
            ),
            "modified_at": "2025-12-02",
            "roles": ["analyst", "admin"],
        },
        {
            "id": "doc-parsing-slas",
            "title": "Document Parsing Service SLAs",
            "section": "SLAs and Failure Modes",
            "text": (
                "The document parsing service has an SLA of 99.5% monthly uptime. "
                "Average parsing latency must be under 3 seconds per document. "
                "Failure modes include OCR timeouts, unsupported file formats, "
                "and extraction rule mismatches. In these cases, the service "
                "emits structured error codes for manual review."
            ),
            "modified_at": "2025-12-03",
            "roles": ["analyst", "support", "admin"],
        },
    ]

    upsert_documents(sample_docs)
