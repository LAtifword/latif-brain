from fastapi import APIRouter, HTTPException

from app.core.database import get_connection
from app.core.security import hash_pin, verify_pin
from app.models.schemas import AuthStatus, PinSetIn, PinVerifyIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status", response_model=AuthStatus)
async def auth_status() -> AuthStatus:
    conn = await get_connection()
    try:
        cursor = await conn.execute("SELECT pin_hash FROM auth WHERE id = 1")
        row = await cursor.fetchone()
        return AuthStatus(pin_configured=bool(row and row["pin_hash"]))
    finally:
        await conn.close()


@router.post("/pin", response_model=AuthStatus)
async def set_pin(body: PinSetIn) -> AuthStatus:
    conn = await get_connection()
    try:
        await conn.execute(
            "UPDATE auth SET pin_hash = ? WHERE id = 1", (hash_pin(body.pin),)
        )
        await conn.commit()
        return AuthStatus(pin_configured=True)
    finally:
        await conn.close()


@router.post("/pin/verify")
async def verify_pin_endpoint(body: PinVerifyIn) -> dict:
    conn = await get_connection()
    try:
        cursor = await conn.execute("SELECT pin_hash FROM auth WHERE id = 1")
        row = await cursor.fetchone()
        if not row or not row["pin_hash"]:
            raise HTTPException(status_code=400, detail="No PIN configured")
        valid = verify_pin(body.pin, row["pin_hash"])
        return {"valid": valid}
    finally:
        await conn.close()
