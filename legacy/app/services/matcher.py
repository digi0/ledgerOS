"""Match a classified document to a client within the firm.

Match order (cheapest signal first):
    1. GSTIN present in extracted fields or OCR text -> client.gstin
    2. Sender email domain -> client.primary_domain
    3. Vendor-name memory (built up over time per firm)
"""
from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Client

GSTIN_RE = re.compile(r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")


def find_gstins(text: str) -> list[str]:
    return list({m.group(0) for m in GSTIN_RE.finditer(text or "")})


def match_client(
    db: Session, firm_id: uuid.UUID, ocr_text: str, sender_email: str | None
) -> uuid.UUID | None:
    for gstin in find_gstins(ocr_text):
        client = db.execute(
            select(Client).where(Client.firm_id == firm_id, Client.gstin == gstin)
        ).scalar_one_or_none()
        if client is not None:
            return client.id

    if sender_email and "@" in sender_email:
        domain = sender_email.split("@", 1)[1].lower()
        client = db.execute(
            select(Client).where(Client.firm_id == firm_id, Client.primary_domain == domain)
        ).scalar_one_or_none()
        if client is not None:
            return client.id

    return None
