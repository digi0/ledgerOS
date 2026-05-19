# LedgerOS

The operating system for modern CA practices — by Precedal.

This repo is the backend for LedgerOS. We're building **tool-by-tool**, starting
with **Tool 1 — Document Ingestion**: pull from Gmail, OCR, AI-classify, match
to client, route into downstream modules.

## Stack

- **FastAPI** (HTTP API) + **Pydantic v2**
- **PostgreSQL 16** (via SQLAlchemy 2.0 + Alembic)
- **Celery + Redis** (ingestion pipeline)
- **MinIO** locally / **S3** in prod (document storage)
- **Anthropic Claude** (classification + extraction)
- **Gmail API** (first inbox connector)

## Repo layout

```
app/
  api/         FastAPI routers (health, documents, gmail oauth)
  models/      SQLAlchemy models (firm, user, client, email_account,
               ingested_email, document)
  schemas/     Pydantic response shapes
  services/    Gmail connector, OCR, classifier, client matcher
  storage.py   S3/MinIO client
  db.py        SQLAlchemy engine + session
  config.py    Settings (pydantic-settings, reads .env)
  main.py      FastAPI factory
worker/
  celery_app.py
  tasks.py     5-step pipeline (pull → extract → classify → match → finalize)
migrations/    Alembic
docker-compose.yml   Postgres + Redis + MinIO for local dev
```

## Quickstart (local dev)

Prerequisites: Python 3.12+, Docker.

```bash
cp .env.example .env       # then edit values as needed
make install               # creates .venv, installs deps
make up                    # starts Postgres + Redis + MinIO
make revision m="init"     # autogenerate first migration from models
make migrate               # apply it
make api                   # FastAPI on http://localhost:8000
make worker                # Celery worker (separate terminal)
```

Check `http://localhost:8000/health` and `http://localhost:8000/docs`.

MinIO console: `http://localhost:9001` (user/pass from `.env`).

## What's done

- Repo scaffold, infra (Postgres/Redis/MinIO), settings, Alembic.
- Data model for Tool 1: `firm`, `user`, `client`, `email_account`,
  `ingested_email`, `document`.
- Read APIs for documents (list + detail).
- Celery app + pipeline task skeletons (NotImplementedError bodies — fill in
  as we build).

## What's next (Tool 1, in order)

1. Gmail OAuth: implement `app/services/gmail.py`, wire `/auth/gmail/start`
   and `/auth/gmail/callback`, persist tokens on `EmailAccount`.
2. Polling worker that pulls new messages per active `EmailAccount`.
3. `extract_attachments` → S3 + `Document` rows + OCR (`pypdf` for text PDFs,
   Tesseract/hosted OCR for the rest).
4. `classify` → Claude call returning `{classification, confidence, fields}`.
5. `match_to_client` → already drafted in `app/services/matcher.py`.
6. End-to-end smoke test with real forwarded emails.

## Roadmap (after Tool 1 ships)

Tool 2 Clients → Tool 3 GST recon → Tool 4 TDS / 26AS → Tool 5 ITR prep →
Tool 6 Compliance calendar → Tool 7 AI Copilot.
