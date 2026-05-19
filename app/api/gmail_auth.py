from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/start")
def start_oauth() -> dict:
    """
    Stub: will return a Google OAuth consent URL once GOOGLE_CLIENT_ID/SECRET are set
    and the gmail service is implemented.
    """
    raise HTTPException(status_code=501, detail="Gmail OAuth not wired yet")


@router.get("/callback")
def oauth_callback(code: str | None = None, state: str | None = None) -> dict:
    """Stub: exchanges `code` for tokens, stores them on an EmailAccount."""
    raise HTTPException(status_code=501, detail="Gmail OAuth callback not wired yet")
