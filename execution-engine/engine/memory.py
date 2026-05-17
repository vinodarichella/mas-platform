"""
DB-backed user memory for the MAS Platform.
Stores and retrieves key facts about a user across sessions.
Injects relevant memory into agent system prompts.

Uses the user_memory table (PostgreSQL) rather than requiring the mem0 cloud service.
When agent-framework-mem0 is available, it can be swapped in as a drop-in replacement.
"""
from __future__ import annotations

import json
from typing import Any

import asyncpg

from core.settings import settings


class UserMemory:

    def __init__(self, user_id: str):
        self.user_id = user_id

    async def load(self) -> list[dict]:
        """Return all memory entries for this user."""
        conn = await asyncpg.connect(settings.database_url_sync)
        try:
            rows = await conn.fetch(
                "SELECT key, value FROM user_memory WHERE user_id = $1 ORDER BY updated_at DESC",
                self.user_id,
            )
            return [{"key": r["key"], "value": r["value"]} for r in rows]
        finally:
            await conn.close()

    async def save(self, key: str, value: str):
        """Upsert a memory entry."""
        conn = await asyncpg.connect(settings.database_url_sync)
        try:
            await conn.execute(
                """INSERT INTO user_memory (user_id, key, value)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (user_id, key)
                   DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()""",
                self.user_id, key, value,
            )
        finally:
            await conn.close()

    async def delete(self, key: str):
        conn = await asyncpg.connect(settings.database_url_sync)
        try:
            await conn.execute(
                "DELETE FROM user_memory WHERE user_id = $1 AND key = $2",
                self.user_id, key,
            )
        finally:
            await conn.close()

    def build_context_string(self, memories: list[dict]) -> str:
        """Format memory entries into a string to inject into the agent prompt."""
        if not memories:
            return ""
        lines = "\n".join(f"- {m['key']}: {m['value']}" for m in memories)
        return f"\n\nUser memory (facts learned from previous sessions):\n{lines}"


def inject_memory_into_instructions(
    instructions: str,
    memories: list[dict],
    user_preferences: dict,
) -> str:
    """
    Append memory and preference context to agent instructions.
    Called by workflow_runner before building each agent.
    """
    extra = ""

    if memories:
        mem = UserMemory(user_id="")
        extra += mem.build_context_string(memories)

    if user_preferences:
        prefs = "; ".join(f"{k}: {v}" for k, v in user_preferences.items())
        extra += f"\n\nUser preferences: {prefs}"

    return instructions + extra if extra else instructions


def format_history_for_agent(history: list[dict]) -> list[dict]:
    """
    Convert conversation history (list of {role, content}) into the format
    MAF expects for multi-turn context injection.
    """
    return [
        {"role": h.get("role", "user"), "content": h.get("content", "")}
        for h in history
        if h.get("content")
    ]
