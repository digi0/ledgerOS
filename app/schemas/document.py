import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentClassification, DocumentStatus


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firm_id: uuid.UUID
    client_id: uuid.UUID | None
    source_email_id: uuid.UUID | None
    filename: str
    mime_type: str | None
    size_bytes: int | None
    storage_uri: str
    classification: DocumentClassification
    classification_confidence: float | None
    extracted_fields: dict
    status: DocumentStatus
    error: str | None
    created_at: datetime
    updated_at: datetime
