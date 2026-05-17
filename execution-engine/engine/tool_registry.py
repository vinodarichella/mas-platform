"""
Central registry for function tools available to agents.
Built-in tools are registered at import time.
MCP and OpenAPI tools are built dynamically by agent_factory per agent config.
"""
from __future__ import annotations

import math
import datetime as dt
import os
from typing import Any, Callable

_registry: dict[str, Any] = {}


class ToolRegistry:

    @classmethod
    def register(cls, name: str, fn: Callable):
        _registry[name] = fn

    @classmethod
    def get(cls, name: str) -> Any | None:
        return _registry.get(name)

    @classmethod
    def all_names(cls) -> list[str]:
        return list(_registry.keys())


# ── Built-in tools ────────────────────────────────────────────────────────────

def _web_search(query: str) -> str:
    """Search the web for information about a topic."""
    # Stub — replace with a real search API (Brave, SerpAPI, etc.) when ready
    return f"[web_search] No results available for: {query}. Configure a search API key to enable."


def _calculator(expression: str) -> str:
    """Evaluate a mathematical expression safely.

    Examples: '2 + 2', 'sqrt(16)', 'sin(pi / 2)', '10 ** 3'
    """
    # Whitelist of safe names for eval
    safe_globals = {
        "__builtins__": {},
        "abs": abs, "round": round, "min": min, "max": max, "sum": sum,
        "pow": pow, "divmod": divmod,
        "sqrt": math.sqrt, "ceil": math.ceil, "floor": math.floor,
        "log": math.log, "log2": math.log2, "log10": math.log10,
        "exp": math.exp, "pi": math.pi, "e": math.e,
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "asin": math.asin, "acos": math.acos, "atan": math.atan, "atan2": math.atan2,
        "degrees": math.degrees, "radians": math.radians,
        "factorial": math.factorial, "gcd": math.gcd,
        "inf": math.inf, "nan": math.nan,
    }
    try:
        result = eval(expression.strip(), safe_globals, {})  # noqa: S307
        return str(result)
    except ZeroDivisionError:
        return "Error: division by zero"
    except Exception as exc:
        return f"Error evaluating expression: {exc}"


def _datetime(query: str = "now") -> str:
    """Return the current date and/or time information.

    Accepts: 'now', 'date', 'time', 'utc', 'timestamp', 'weekday'
    """
    now = dt.datetime.now()
    utc = dt.datetime.utcnow()

    q = query.lower().strip()
    if q in ("date", "today"):
        return now.strftime("%Y-%m-%d (%A)")
    if q == "time":
        return now.strftime("%H:%M:%S")
    if q == "utc":
        return utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    if q == "timestamp":
        return str(int(now.timestamp()))
    if q == "weekday":
        return now.strftime("%A")
    # Default: full ISO datetime with timezone offset
    return now.strftime("%Y-%m-%d %H:%M:%S (local)")


def _file_reader(path: str) -> str:
    """Read a text file from the filesystem (restricted to /tmp and current directory).

    Args:
        path: Absolute or relative file path.
    """
    # Safety: restrict to safe directories
    abs_path = os.path.abspath(path)
    safe_roots = ["/tmp", os.getcwd()]
    if not any(abs_path.startswith(root) for root in safe_roots):
        return f"Error: access denied. Only /tmp and the working directory are accessible."
    if not os.path.isfile(abs_path):
        return f"Error: file not found: {abs_path}"
    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(50_000)  # cap at 50 KB
        if len(content) == 50_000:
            content += "\n[... truncated at 50 KB ...]"
        return content
    except Exception as exc:
        return f"Error reading file: {exc}"


ToolRegistry.register("web_search",  _web_search)
ToolRegistry.register("calculator",  _calculator)
ToolRegistry.register("datetime",    _datetime)
ToolRegistry.register("file_reader", _file_reader)
