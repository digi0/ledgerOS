import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPKMixin


class EmailProvider(str, enum.Enum):
    gmail = "gmail"
    outlook = "outlook"
    imap = "imap"


class EmailAccount(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "email_account"

    firm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("firm.id", ondelete="CASCADE"), index=True, nullable=False
    )
    provider: Mapped[EmailProvider] = mapped_column(
        Enum(EmailProvider, name="email_provider"), nullable=False
    )
    email_address: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    # OAuth tokens / IMAP creds — encrypt at rest in prod.
    credentials: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    last_history_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
