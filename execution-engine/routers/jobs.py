"""
Background job management.
Background runs use jobType='background' and can run for hours.
The engine fires them as asyncio tasks (DurableTask integration is optional).
Status is tracked in the runs table; SSE events still go through run_events.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from core.settings import settings
from engine.event_journal import EventJournal
from engine.workflow_runner import WorkflowRunner

log    = logging.getLogger(__name__)
router = APIRouter(tags=["jobs"])

# Keep handles so we can cancel background tasks
_running_tasks: dict[str, asyncio.Task] = {}


def _require_internal_key(x_internal_key: str = Header(..., alias="X-Internal-Key")):
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=403, detail="Invalid internal API key")


class JobRequest(BaseModel):
    run_id:               str
    user_id:              str
    session_id:           str | None = None
    workflow_config:      dict
    agent_configs:        list[dict]
    inputs:               dict = {}
    conversation_history: list[dict] = []
    user_memory:          list[dict] = []
    user_preferences:     dict = {}
    max_duration_minutes: int  = 480   # 8-hour default cap


@router.post("", dependencies=[Depends(_require_internal_key)])
async def submit_background_job(req: JobRequest):
    """
    Submit a long-running background job.
    Returns immediately; the job runs in the background.
    """
    runner = WorkflowRunner(
        run_id=req.run_id,
        workflow_config=req.workflow_config,
        agent_configs=req.agent_configs,
        inputs=req.inputs,
        conversation_history=req.conversation_history,
        user_memory=req.user_memory,
        user_preferences=req.user_preferences,
    )

    # Wrap with a timeout
    async def _run_with_timeout():
        try:
            await asyncio.wait_for(
                runner.run(),
                timeout=req.max_duration_minutes * 60,
            )
        except asyncio.TimeoutError:
            journal = EventJournal(run_id=req.run_id)
            await journal.publish_event("error", {
                "message": f"Job exceeded max duration of {req.max_duration_minutes} minutes",
            })
            await journal.set_run_status("failed")
        finally:
            _running_tasks.pop(req.run_id, None)

    task = asyncio.create_task(_run_with_timeout())
    _running_tasks[req.run_id] = task
    log.info("Background job %s started (max %dm)", req.run_id, req.max_duration_minutes)
    return {"run_id": req.run_id, "status": "queued"}


@router.get("/{run_id}/status")
async def job_status(run_id: str):
    journal = EventJournal(run_id=run_id)
    status = await journal.get_run_status()
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    running = run_id in _running_tasks and not _running_tasks[run_id].done()
    return {**status, "task_running": running}


@router.post("/{run_id}/cancel", dependencies=[Depends(_require_internal_key)])
async def cancel_background_job(run_id: str):
    task = _running_tasks.pop(run_id, None)
    if task and not task.done():
        task.cancel()
        log.info("Background job %s cancelled", run_id)

    journal = EventJournal(run_id=run_id)
    await journal.publish_event("cancelled", {"reason": "user_cancelled"})
    await journal.set_run_status("cancelled")
    return {"status": "cancelled"}
