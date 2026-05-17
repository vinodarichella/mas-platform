"""
Event journal backed by PostgreSQL.
- Writes every run event to run_events table with a monotonic sequence_id.
- Uses pg_notify / LISTEN for real-time SSE tailing (replaces Redis pub/sub).
- Uses SELECT … FOR UPDATE SKIP LOCKED on the runs table for background job queue.
- Clients reconnect with Last-Event-ID and get all missed events replayed.
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

import asyncpg

from core.settings import settings


class EventJournal:

    def __init__(self, run_id: str):
        self.run_id    = run_id
        self._channel  = f"run_event_{run_id}"

    # ── Write ──────────────────────────────────────────────────────────────────

    async def publish_event(self, event_type: str, payload: dict) -> int:
        """Insert event row and return its sequence_id."""
        async with _pool() as conn:
            seq = await conn.fetchval(
                """
                INSERT INTO run_events (run_id, sequence_id, event_type, payload)
                VALUES ($1,
                        COALESCE(
                            (SELECT MAX(sequence_id) FROM run_events WHERE run_id = $1),
                            0
                        ) + 1,
                        $2, $3)
                RETURNING sequence_id
                """,
                self.run_id, event_type, json.dumps(payload),
            )
            return seq

    async def set_run_status(self, status: str, extra: dict | None = None):
        async with _pool() as conn:
            await conn.execute(
                """UPDATE runs SET status = $1,
                   completed_at = CASE WHEN $1 IN ('completed','failed','cancelled')
                                       THEN NOW() ELSE completed_at END
                   WHERE id = $2""",
                status, self.run_id,
            )

    async def get_run_status(self) -> dict | None:
        async with _pool() as conn:
            row = await conn.fetchrow(
                "SELECT status, last_event_seq FROM runs WHERE id = $1",
                self.run_id,
            )
            return dict(row) if row else None

    # ── Read / Replay ──────────────────────────────────────────────────────────

    async def replay_from(self, last_seq: int) -> AsyncGenerator[dict, None]:
        """Yield all stored events with sequence_id > last_seq."""
        async with _pool() as conn:
            rows = await conn.fetch(
                """SELECT sequence_id, event_type, payload
                   FROM run_events
                   WHERE run_id = $1 AND sequence_id > $2
                   ORDER BY sequence_id""",
                self.run_id, last_seq,
            )
        for row in rows:
            yield {
                "sequence_id": row["sequence_id"],
                "event_type":  row["event_type"],
                "payload":     json.loads(row["payload"]),
            }

    async def subscribe(self) -> AsyncGenerator[dict, None]:
        """
        Tail new events in real-time using PostgreSQL LISTEN/NOTIFY.
        The DB trigger fires pg_notify on every run_events INSERT.
        """
        conn = await asyncpg.connect(settings.database_url_sync)
        try:
            queue: asyncio.Queue[dict] = asyncio.Queue()

            async def _on_notify(_conn, _pid, _channel, payload):
                seq = int(payload)
                # Fetch the full event row
                row = await conn.fetchrow(
                    "SELECT sequence_id, event_type, payload "
                    "FROM run_events WHERE run_id = $1 AND sequence_id = $2",
                    self.run_id, seq,
                )
                if row:
                    await queue.put({
                        "sequence_id": row["sequence_id"],
                        "event_type":  row["event_type"],
                        "payload":     json.loads(row["payload"]),
                    })

            await conn.add_listener(self._channel, _on_notify)

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield event
                    if event["event_type"] in ("completed", "error", "cancelled"):
                        return
                except asyncio.TimeoutError:
                    # Send a keepalive comment; caller decides whether to close
                    yield {"sequence_id": 0, "event_type": "keepalive", "payload": {}}
        finally:
            await conn.remove_listener(self._channel, _on_notify)
            await conn.close()

    # ── HITL ──────────────────────────────────────────────────────────────────

    async def publish_hitl_request(self, prompt: str) -> str:
        async with _pool() as conn:
            hitl_id = await conn.fetchval(
                "INSERT INTO hitl_requests (run_id, prompt) VALUES ($1, $2) RETURNING id",
                self.run_id, prompt,
            )
        return str(hitl_id)

    async def publish_hitl_response(self, hitl_id: str, response: dict):
        async with _pool() as conn:
            await conn.execute(
                """UPDATE hitl_requests
                   SET response = $1, status = 'responded', responded_at = NOW()
                   WHERE id = $2""",
                json.dumps(response), hitl_id,
            )

    async def wait_for_hitl(self, hitl_id: str, timeout: float = 3600) -> dict:
        """Poll until HITL response arrives (simple 1-second polling loop)."""
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            async with _pool() as conn:
                row = await conn.fetchrow(
                    "SELECT response FROM hitl_requests WHERE id = $1 AND status = 'responded'",
                    hitl_id,
                )
            if row:
                return json.loads(row["response"])
            await asyncio.sleep(1)
        raise TimeoutError(f"HITL timed out after {timeout}s")


# ── Connection pool (module-level singleton) ───────────────────────────────────

_conn_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    global _conn_pool
    if _conn_pool is None:
        _conn_pool = await asyncpg.create_pool(
            settings.database_url_sync, min_size=2, max_size=10
        )
    return _conn_pool


class _pool:
    """Async context manager that acquires a connection from the pool."""
    async def __aenter__(self):
        pool = await _get_pool()
        self._conn = await pool.acquire()
        return self._conn

    async def __aexit__(self, *_):
        pool = await _get_pool()
        await pool.release(self._conn)
