import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPKMixin


class IngestedEmail(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "ingested_email"
    __table_args__ = (
        UniqueConstraint("email_account_id", "provider_message_id", name="uq_email_msg"),
    )

    firm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("firm.id", ondelete="CASCADE"), index=True, nullable=False
    )
    email_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_account.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    provider_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sender: Mapped[str | None] = mapped_column(String(320), index=True, nullable=True)
    subject: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_meta: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
