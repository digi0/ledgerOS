import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPKMixin


class Client(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "client"
    __table_args__ = (UniqueConstraint("firm_id", "gstin", name="uq_client_firm_gstin"),)

    firm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("firm.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), index=True, nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), index=True, nullable=True)
    primary_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    primary_domain: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
