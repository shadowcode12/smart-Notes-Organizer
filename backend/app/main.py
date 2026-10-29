from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status
import firebase_admin
from firebase_admin import auth as firebase_auth


if not firebase_admin._apps:
    firebase_admin.initialize_app()

app = FastAPI(title="SmartNotes Backend")


def require_user(authorization: Annotated[str | None, Header()] = None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        return firebase_auth.verify_id_token(token)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token") from error


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/me")
def me(user: Annotated[dict, Depends(require_user)]) -> dict[str, str | None]:
    return {"uid": user.get("uid", ""), "email": user.get("email")}
