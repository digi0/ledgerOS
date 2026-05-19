import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Document
from app.models.document import DocumentClassification, DocumentStatus
from app.schemas.document import DocumentOut

router = APIRouter()


@router.get("", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    classification: DocumentClassification | None = Query(default=None),
    status: DocumentStatus | None = Query(default=None),
    limit: int = Query(default=50, le=200),
) -> list[Document]:
    stmt = select(Document).order_by(Document.created_at.desc()).limit(limit)
    if classification is not None:
        stmt = stmt.where(Document.classification == classification)
    if status is not None:
        stmt = stmt.where(Document.status == status)
    return list(db.execute(stmt).scalars().all())


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> Document:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc
