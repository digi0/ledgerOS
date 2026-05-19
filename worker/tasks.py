"""The 5-step ingestion pipeline (stub implementations).

Real bodies land as Tool 1 progresses; the shapes below are the contract
the API layer and Gmail connector will hand off to.

    pull_email -> extract_attachments -> classify -> match_to_client -> finalize
"""
from __future__ import annotations

import uuid

from celery import chain

from worker.celery_app import celery_app


@celery_app.task(name="pipeline.pull_email")
def pull_email(email_account_id: str, provider_message_id: str) -> str:
    """Fetch a single message from the provider, persist IngestedEmail row, return its id."""
    raise NotImplementedError


@celery_app.task(name="pipeline.extract_attachments")
def extract_attachments(ingested_email_id: str) -> list[str]:
    """Pull attachments, store in S3, create Document rows in `received`, return ids."""
    raise NotImplementedError


@celery_app.task(name="pipeline.classify")
def classify(document_id: str) -> str:
    """Run OCR + Claude classifier, write classification + extracted_fields."""
    raise NotImplementedError


@celery_app.task(name="pipeline.match_to_client")
def match_to_client(document_id: str) -> str:
    """Match by GSTIN -> sender domain -> vendor memory; set document.client_id."""
    raise NotImplementedError


@celery_app.task(name="pipeline.finalize")
def finalize(document_id: str) -> str:
    """Mark document ready and emit downstream event."""
    raise NotImplementedError


def enqueue_email(email_account_id: uuid.UUID, provider_message_id: str) -> None:
    """Public entrypoint used by the Gmail connector / webhook."""
    chain(
        pull_email.s(str(email_account_id), provider_message_id),
        extract_attachments.s(),
        # extract_attachments returns a list; fan-out happens inside that task once implemented.
    ).apply_async()
