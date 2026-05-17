"""
Builds MAF Agent instances from config dicts stored in the DB.

Supported providers:
  azure      — Azure OpenAI (primary)
  databricks — Databricks Model Serving (OpenAI-compatible, custom base_url)
  openai     — OpenAI direct
  anthropic  — Anthropic Claude
  gemini     — Google Gemini
"""
from __future__ import annotations

import logging
from typing import Any

from core.settings import settings

log = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = ["azure", "databricks", "openai", "anthropic", "gemini"]
REQUIRED_FIELDS = ["name", "provider", "model"]

PROVIDER_MODELS: dict[str, list[str]] = {
    "azure": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-35-turbo"],
    "databricks": [
        "databricks-meta-llama-3-3-70b-instruct",
        "databricks-meta-llama-3-1-405b-instruct",
        "databricks-dbrx-instruct",
        "databricks-mixtral-8x7b-instruct",
    ],
    "openai":    ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    "anthropic": ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
    "gemini":    ["gemini-2.0-flash", "gemini-1.5-pro"],
}


class AgentFactory:

    @staticmethod
    def validate_config(config: dict) -> list[str]:
        errors = []
        for field in REQUIRED_FIELDS:
            if not config.get(field):
                errors.append(f"Missing required field: {field}")
        provider = config.get("provider", "")
        if provider and provider not in SUPPORTED_PROVIDERS:
            errors.append(f"Unsupported provider '{provider}'. Choose from: {SUPPORTED_PROVIDERS}")
        return errors

    @staticmethod
    def get_available_providers() -> dict[str, list[str]]:
        available: dict[str, list[str]] = {}
        if settings.azure_openai_api_key and settings.azure_openai_endpoint:
            available["azure"] = PROVIDER_MODELS["azure"]
        if settings.databricks_host and settings.databricks_token:
            available["databricks"] = PROVIDER_MODELS["databricks"]
        if settings.openai_api_key:
            available["openai"] = PROVIDER_MODELS["openai"]
        if settings.anthropic_api_key:
            available["anthropic"] = PROVIDER_MODELS["anthropic"]
        if settings.gemini_api_key:
            available["gemini"] = PROVIDER_MODELS["gemini"]
        return available

    @staticmethod
    def build(config: dict, history: list[dict] | None = None) -> Any:
        from agent_framework import Agent

        client   = AgentFactory._build_client(config)
        tools    = AgentFactory._build_tools(config.get("tools", []))
        alias    = config.get("alias") or config.get("name", "assistant")
        instructions = config.get("instructions", "You are a helpful assistant.")

        kwargs: dict = dict(
            name=alias,
            instructions=instructions,
            client=client,
            tools=tools,
        )
        return Agent(**kwargs)

    @staticmethod
    def _build_client(config: dict) -> Any:
        provider = config["provider"]
        model    = config["model"]

        if provider == "azure":
            from agent_framework.openai import AzureOpenAIChatClient
            return AzureOpenAIChatClient(
                model=model,
                api_key=settings.azure_openai_api_key,
                azure_endpoint=settings.azure_openai_endpoint,
                api_version=settings.azure_openai_api_version,
            )

        if provider == "databricks":
            from openai import AsyncOpenAI
            from agent_framework.openai import OpenAIChatClient
            base_url = f"{settings.databricks_host.rstrip('/')}/serving-endpoints"
            return OpenAIChatClient(
                model=model,
                client=AsyncOpenAI(api_key=settings.databricks_token, base_url=base_url),
            )

        if provider == "openai":
            from agent_framework.openai import OpenAIChatClient
            return OpenAIChatClient(model=model, api_key=settings.openai_api_key)

        if provider == "anthropic":
            from agent_framework.anthropic import AnthropicChatClient
            return AnthropicChatClient(model=model, api_key=settings.anthropic_api_key)

        if provider == "gemini":
            from agent_framework.gemini import GeminiChatClient
            return GeminiChatClient(model=model, api_key=settings.gemini_api_key)

        raise ValueError(f"Unsupported provider: {provider}")

    @staticmethod
    def _build_tools(tool_configs: list[dict]) -> list:
        tools = []
        for tc in tool_configs:
            t = AgentFactory._build_one_tool(tc)
            if t is not None:
                tools.append(t)
        return tools

    @staticmethod
    def _build_one_tool(tc: dict) -> Any | None:
        tool_type = tc.get("type")

        # ── Function tool ──────────────────────────────────────────────────────
        if tool_type == "function":
            from engine.tool_registry import ToolRegistry
            name = tc.get("name", "")
            tool = ToolRegistry.get(name)
            if tool is None:
                log.warning("Function tool '%s' not found in registry", name)
            return tool

        # ── MCP tool ───────────────────────────────────────────────────────────
        if tool_type == "mcp":
            try:
                from agent_framework.mcp import MCPServerTool
                server = tc.get("server", "")
                tool   = tc.get("tool", "")
                return MCPServerTool(server=server, tool=tool)
            except ImportError:
                log.warning("agent_framework.mcp not available — skipping MCP tool %s/%s",
                            tc.get("server"), tc.get("tool"))
                return None
            except Exception as exc:
                log.warning("Failed to build MCP tool %s/%s: %s",
                            tc.get("server"), tc.get("tool"), exc)
                return None

        # ── OpenAPI tool ───────────────────────────────────────────────────────
        if tool_type == "openapi":
            try:
                from agent_framework.openapi import OpenAPIToolset
                spec_url = tc.get("spec_url", "")
                name     = tc.get("name", "openapi_tool")
                return OpenAPIToolset(spec_url=spec_url, name=name)
            except ImportError:
                log.warning("agent_framework.openapi not available — skipping OpenAPI tool %s",
                            tc.get("name"))
                return None
            except Exception as exc:
                log.warning("Failed to build OpenAPI tool %s: %s", tc.get("name"), exc)
                return None

        log.warning("Unknown tool type: %s", tool_type)
        return None
