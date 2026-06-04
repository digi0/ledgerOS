"""LLM-based document classification using Claude.

Returns a classification label (one of DocumentClassification) plus a
confidence and a flat extracted-fields dict the downstream modules consume
(e.g. invoice → vendor_name, gstin, invoice_number, date, taxable_value, gst).
"""
from __future__ import annotations

from typing import Any

from app.models.document import DocumentClassification

# Real implementation will use anthropic.Anthropic(...).messages.create(...)
# with a structured-output prompt. Stubbed for the scaffold.


def classify_document(text: str) -> dict[str, Any]:
    return {
        "classification": DocumentClassification.unknown,
        "confidence": 0.0,
        "extracted_fields": {},
    }
