import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPKMixin


class DocumentStatus(str, enum.Enum):
    received = "received"      # fetched from source
    extracted = "extracted"    # OCR / text extraction done
    classified = "classified"  # AI classification done
    matched = "matched"        # linked to a client
    ready = "ready"            # finalized, available for downstream modules
    failed = "failed"


class DocumentClassification(str, enum.Enum):
    unknown = "unknown"
    invoice = "invoice"
    bank_statement = "bank_statement"
    notice = "notice"
    receipt = "receipt"
    tds_certificate = "tds_certificate"
    other = "other"


class Document(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "document"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("firm.id", ondelete="CASCADE"), index=True, nullable=False
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client.id", ondelete="SET NULL"), index=True, nullable=True
    )
    source_email_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingested_email.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )

    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_uri: Mapped[str] = mapped_column(String(1024), nullable=False)

    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    classification: Mapped[DocumentClassification] = mapped_column(
        Enum(DocumentClassification, name="document_classification"),
        default=DocumentClassification.unknown,
        nullable=False,
    )
    classification_confidence: Mapped[float | None] = mapped_column(nullable=True)
    extracted_fields: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status"),
        default=DocumentStatus.received,
        nullable=False,
        index=True,
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
