from fastapi import APIRouter
from pydantic import BaseModel
import asyncpg
from core.settings import settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    services: dict


@router.get("/health", response_model=HealthResponse)
async def health():
    services = {"api": "ok", "database": "unknown"}
    try:
        conn = await asyncpg.connect(settings.database_url_sync, timeout=3)
        await conn.fetchval("SELECT 1")
        await conn.close()
        services["database"] = "ok"
    except Exception:
        services["database"] = "unavailable"

    overall = "ok" if all(v == "ok" for v in services.values()) else "degraded"
    return HealthResponse(status=overall, services=services)
