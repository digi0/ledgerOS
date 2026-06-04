"""OCR + text extraction.

v1: text-layer PDFs via pypdf; image PDFs / images go through Tesseract or a
hosted OCR (TBD). We keep this thin so the worker doesn't care which backend ran.
"""
from io import BytesIO

from pypdf import PdfReader


def extract_text_from_pdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            parts.append("")
    return "\n".join(parts).strip()
