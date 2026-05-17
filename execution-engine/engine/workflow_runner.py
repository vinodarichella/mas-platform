"""
Routes a workflow execution request to the correct MAF orchestration builder,
relaying all AG-UI events through EventJournal.

Phase 6 additions:
  - Progress events emitted between agent steps (sequential / concurrent / handoff)
  - HITL pause-and-wait: intercepts hitl_request events, blocks on DB poll,
    resumes when the user submits a response via the Java API
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from engine.agent_factory import AgentFactory
from engine.event_journal import EventJournal
from engine.memory import inject_memory_into_instructions, format_history_for_agent

log = logging.getLogger(__name__)

_TERMINAL_TYPES = {"completed", "error", "cancelled"}
_HITL_TYPES     = {"hitl_request", "hitl", "human_input_requested"}
_ALIAS_MAP = {
    "text":          "agent_message",
    "response":      "agent_message",
    "output":        "agent_message",
    "message":       "agent_message",
    "tool_use":      "tool_call",
    "tool_response": "tool_result",
    "think":         "thinking",
    "thought":       "thinking",
}


class WorkflowRunner:

    def __init__(
        self,
        run_id: str,
        workflow_config: dict,
        agent_configs: list[dict],
        inputs: dict,
        conversation_history: list[dict],
        user_memory: list[dict],
        user_preferences: dict,
    ):
        self.run_id     = run_id
        self.config     = workflow_config
        self.agent_cfgs = {c["id"]: c for c in agent_configs}
        self.inputs     = inputs
        self.history    = format_history_for_agent(conversation_history)
        self.memory     = user_memory
        self.prefs      = user_preferences
        self.journal    = EventJournal(run_id=run_id)
        # Progress tracking
        self._step      = 0
        self._total     = 0

    # ── Entry point ────────────────────────────────────────────────────────────

    async def run(self):
        await self.journal.set_run_status("running")
        orch_type = self.config.get("orchestration_type", "declarative")

        try:
            await self.journal.publish_event("step_start", {
                "step": "initializing",
                "orchestration_type": orch_type,
            })
            dispatch = {
                "sequential":  self._run_sequential,
                "concurrent":  self._run_concurrent,
                "handoff":     self._run_handoff,
                "groupchat":   self._run_groupchat,
                "magentic":    self._run_magentic,
                "declarative": self._run_declarative,
            }
            await dispatch.get(orch_type, self._run_declarative)()
            await self.journal.publish_event("completed", {"run_id": self.run_id})
            await self.journal.set_run_status("completed")

        except asyncio.CancelledError:
            await self.journal.publish_event("cancelled", {"run_id": self.run_id})
            await self.journal.set_run_status("cancelled")
        except Exception as exc:
            log.exception("Run %s failed", self.run_id)
            await self.journal.publish_event("error", {"message": str(exc), "run_id": self.run_id})
            await self.journal.set_run_status("failed")
            raise

    # ── Orchestration runners ──────────────────────────────────────────────────

    async def _run_sequential(self):
        from agent_framework.orchestrations import SequentialBuilder
        agents = self._build_agents()
        task   = self.inputs.get("message", "")
        self._step = 0
        self._total = len(agents)

        await self.journal.publish_event("planning", {
            "steps": [a.name for a in agents],
            "total": len(agents),
        })

        orchestration = SequentialBuilder().build(agents)
        async for event in orchestration.run_stream(task):
            await self._relay_event(event)

    async def _run_concurrent(self):
        from agent_framework.orchestrations import ConcurrentBuilder
        agents = self._build_agents()
        task   = self.inputs.get("message", "")
        self._total = len(agents)

        await self.journal.publish_event("planning", {
            "strategy": "concurrent",
            "agents": [a.name for a in agents],
        })

        orchestration = ConcurrentBuilder().build(agents)
        async for event in orchestration.run_stream(task):
            await self._relay_event(event)

    async def _run_handoff(self):
        from agent_framework.orchestrations import HandoffBuilder
        agents = self._build_agents()
        task   = self.inputs.get("message", "")
        self._step = 0
        self._total = len(agents)

        await self.journal.publish_event("planning", {
            "strategy": "handoff",
            "chain": [a.name for a in agents],
        })

        orchestration = HandoffBuilder().build(agents)
        async for event in orchestration.run_stream(task):
            await self._relay_event(event)

    async def _run_groupchat(self):
        from agent_framework.orchestrations import GroupChatBuilder
        agents = self._build_agents()
        task   = self.inputs.get("message", "")

        await self.journal.publish_event("planning", {
            "strategy": "groupchat",
            "participants": [a.name for a in agents],
        })

        orchestration = GroupChatBuilder().build(agents)
        async for event in orchestration.run_stream(task):
            await self._relay_event(event)

    async def _run_magentic(self):
        from agent_framework.orchestrations import MagenticBuilder
        agents = self._build_agents()
        task   = self.inputs.get("message", "")

        if not agents:
            raise ValueError("Magentic workflow requires at least one agent")

        orchestrator = agents[0]
        team         = agents[1:]

        await self.journal.publish_event("planning", {
            "strategy":    "magentic",
            "orchestrator": orchestrator.name,
            "team":        [a.name for a in team],
        })

        orchestration = MagenticBuilder().build(orchestrator=orchestrator, team=team)
        async for event in orchestration.run_stream(task):
            await self._relay_event(event)

    async def _run_declarative(self):
        yaml_content = self.config.get("yaml_content", "")
        if not yaml_content:
            log.warning("Run %s: declarative has no yaml_content — falling back to sequential",
                        self.run_id)
            await self._run_sequential()
            return

        try:
            from agent_framework_declarative import DeclarativeWorkflow
        except ImportError:
            log.warning("agent_framework_declarative not installed — falling back to sequential")
            await self._run_sequential()
            return

        wf = DeclarativeWorkflow.from_yaml(yaml_content)
        agent_map = {
            aid: AgentFactory.build(self._enrich(cfg), history=self.history)
            for aid, cfg in self.agent_cfgs.items()
        }
        async for event in wf.run_stream(inputs=self.inputs, agents=agent_map):
            await self._relay_event(event)

    # ── Agent building ─────────────────────────────────────────────────────────

    def _build_agents(self) -> list[Any]:
        agents = []
        for ref in self.config.get("agents", []):
            agent_id = ref.get("ref") or ref.get("id")
            cfg = self.agent_cfgs.get(agent_id)
            if cfg is None:
                raise ValueError(f"Agent config not found: {agent_id}")
            merged = {**cfg}
            if ref.get("alias"):
                merged["alias"] = ref["alias"]
            if ref.get("instructions"):
                merged["instructions"] = ref["instructions"]
            agents.append(AgentFactory.build(self._enrich(merged), history=self.history))
        return agents

    def _enrich(self, cfg: dict) -> dict:
        enriched = {**cfg}
        enriched["instructions"] = inject_memory_into_instructions(
            cfg.get("instructions", "You are a helpful assistant."),
            self.memory,
            self.prefs,
        )
        return enriched

    # ── Event relay ────────────────────────────────────────────────────────────

    async def _relay_event(self, event: Any):
        """
        Normalise a MAF / AG-UI event and publish it.
        Intercepts HITL events to pause execution until human responds.
        Emits progress events after each completed step.
        """
        # Normalise to (event_type: str, payload: dict)
        if isinstance(event, str):
            await self.journal.publish_event("agent_message", {"content": event})
            return

        if isinstance(event, dict):
            event_type = str(event.get("type", "agent_message")).lower()
            payload    = {k: v for k, v in event.items() if k != "type"}
        elif hasattr(event, "type"):
            raw = event.type
            event_type = str(raw.value if hasattr(raw, "value") else raw).lower()
            payload    = event.model_dump(exclude={"type"}) if hasattr(event, "model_dump") else {}
        else:
            await self.journal.publish_event("agent_message", {"content": str(event)})
            return

        event_type = _ALIAS_MAP.get(event_type, event_type)
        payload    = _serialisable(payload)

        # ── HITL intercept ────────────────────────────────────────────────────
        if event_type in _HITL_TYPES:
            await self._handle_hitl(payload)
            return

        # ── Progress on step completion ───────────────────────────────────────
        if event_type == "step_end" and self._total > 0:
            self._step += 1
            pct = round(self._step / self._total * 100)
            step_name = payload.get("step") or payload.get("agent") or f"Step {self._step}"
            await self.journal.publish_event("progress", {
                "step":    self._step,
                "total":   self._total,
                "percent": min(pct, 99),   # 100% reserved for completed event
                "label":   str(step_name),
            })

        await self.journal.publish_event(event_type, payload)

    async def _handle_hitl(self, payload: dict):
        """
        Pause the run, publish a hitl_request SSE event, block until the user
        responds via POST /api/runs/{runId}/hitl, then resume.
        """
        prompt  = payload.get("prompt") or payload.get("message") or "Please provide input."
        timeout = float(payload.get("timeout_minutes", 60)) * 60

        # Record in DB and get a stable hitl_id
        hitl_id = await self.journal.publish_hitl_request(prompt)

        # Notify the frontend
        await self.journal.set_run_status("paused_hitl")
        await self.journal.publish_event("hitl_request", {
            "hitl_id": hitl_id,
            "prompt":  prompt,
        })

        log.info("Run %s paused for HITL %s", self.run_id, hitl_id)

        try:
            response = await self.journal.wait_for_hitl(hitl_id, timeout=timeout)
            await self.journal.set_run_status("running")
            await self.journal.publish_event("hitl_response", {
                "hitl_id":  hitl_id,
                "response": response,
            })
            log.info("Run %s resumed after HITL %s", self.run_id, hitl_id)
        except TimeoutError:
            await self.journal.publish_event("hitl_timeout", {
                "hitl_id": hitl_id,
                "message": f"No response received within {int(timeout // 60)} minutes",
            })
            raise RuntimeError(f"HITL timed out after {int(timeout // 60)} minutes")


# ── Serialisation ─────────────────────────────────────────────────────────────

def _serialisable(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _serialisable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialisable(i) for i in obj]
    if hasattr(obj, "model_dump"):
        return _serialisable(obj.model_dump())
    if hasattr(obj, "__dict__"):
        return _serialisable(vars(obj))
    return obj
