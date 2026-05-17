import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.settings import settings
from engine.event_journal import EventJournal
from engine.workflow_runner import WorkflowRunner

log    = logging.getLogger(__name__)
router = APIRouter(tags=["execute"])


# ── Internal API key auth ─────────────────────────────────────────────────────

def _require_internal_key(x_internal_key: str = Header(..., alias="X-Internal-Key")):
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=403, detail="Invalid internal API key")


# ── Request / response models ─────────────────────────────────────────────────

class ExecuteRequest(BaseModel):
    workflow_id:          str
    run_id:               str
    user_id:              str
    session_id:           str | None = None
    workflow_config:      dict            # parsed workflow definition
    agent_configs:        list[dict]      # agent defs referenced by the workflow
    inputs:               dict = {}
    conversation_history: list[dict] = []
    user_memory:          list[dict] = []
    user_preferences:     dict = {}
    job_type:             str = "interactive"   # interactive | background


class ExecuteResponse(BaseModel):
    run_id: str
    status: str


class HitlResponseBody(BaseModel):
    hitl_id:  str
    response: dict = {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ExecuteResponse,
             dependencies=[Depends(_require_internal_key)])
async def start_execution(req: ExecuteRequest):
    runner = WorkflowRunner(
        run_id=req.run_id,
        workflow_config=req.workflow_config,
        agent_configs=req.agent_configs,
        inputs=req.inputs,
        conversation_history=req.conversation_history,
        user_memory=req.user_memory,
        user_preferences=req.user_preferences,
    )

    # Fire and forget — Java polls run_events for terminal status
    asyncio.create_task(runner.run())

    status = "queued" if req.job_type == "background" else "running"
    return ExecuteResponse(run_id=req.run_id, status=status)


@router.get("/{run_id}/stream")
async def stream_run(run_id: str, request: Request):
    """
    Server-sent events stream for a run.
    Replays missed events from Last-Event-ID, then tails live events via pg_notify.
    The Java RunController also proxies SSE to the browser — this endpoint is
    used when the browser connects directly to Python (dev mode).
    """
    last_event_id = request.headers.get("last-event-id")
    last_seq = int(last_event_id) if last_event_id else 0

    async def event_generator() -> AsyncGenerator[str, None]:
        journal = EventJournal(run_id=run_id)

        async for event in journal.replay_from(last_seq):
            yield _fmt_sse(event)
            if event["event_type"] in ("completed", "error", "cancelled"):
                return

        async for event in journal.subscribe():
            if await request.is_disconnected():
                break
            yield _fmt_sse(event)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{run_id}/status")
async def get_status(run_id: str):
    journal = EventJournal(run_id=run_id)
    status = await journal.get_run_status()
    if not status:
        raise HTTPException(status_code=404, detail="Run not found")
    return status


@router.post("/{run_id}/hitl",
             dependencies=[Depends(_require_internal_key)])
async def resume_hitl(run_id: str, body: HitlResponseBody):
    """Receive a HITL response and store it so the workflow can resume."""
    journal = EventJournal(run_id=run_id)
    await journal.publish_hitl_response(body.hitl_id, body.response)
    return {"status": "ok"}


@router.post("/{run_id}/cancel")
async def cancel_run(run_id: str):
    journal = EventJournal(run_id=run_id)
    await journal.publish_event("cancelled", {"reason": "user_cancelled"})
    await journal.set_run_status("cancelled")
    return {"status": "ok"}


# ── SSE formatter ─────────────────────────────────────────────────────────────

def _fmt_sse(event: dict) -> str:
    seq        = event.get("sequence_id", "")
    event_type = event.get("event_type", "message")
    data       = json.dumps(event.get("payload", {}))
    return f"id: {seq}\nevent: {event_type}\ndata: {data}\n\n"
