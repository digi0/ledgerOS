from fastapi import FastAPI

from app.api import documents, gmail_auth, health


def create_app() -> FastAPI:
    app = FastAPI(title="LedgerOS API", version="0.1.0")
    app.include_router(health.router)
    app.include_router(documents.router, prefix="/documents", tags=["documents"])
    app.include_router(gmail_auth.router, prefix="/auth/gmail", tags=["auth"])
    return app


app = create_app()
