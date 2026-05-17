# MAS Platform — Comprehensive Plan

## Overview

A generic Multi-Agent System (MAS) Platform where users can build, configure, and run
multi-agent workflows through a visual drag-and-drop UI (like Langflow/n8n). Workflows
are defined visually and stored as MAF declarative YAML configs, which are executed at
runtime by the Microsoft Agent Framework (MAF) Python engine.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     React Frontend                                   │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Workflow     │  │ Chat / Multi │  │ Agent      │  │ Run       │  │
│  │ Builder      │  │ Turn Session │  │ Manager    │  │ Monitor   │  │
│  │ (ReactFlow)  │  │ + Memory     │  │            │  │ + Logs    │  │
│  └─────────────┘  └──────────────┘  └────────────┘  └───────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Thinking Panel: [Planning] → [Tool Call] → [Reasoning]...  │    │
│  │  Node Pulse: active node glows in workflow canvas            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  WebSocket (reconnect w/ exponential backoff + missed event replay)  │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                 ┌───────▼────────┐
                 │ Spring Boot    │  ← React static files embedded here
                 │ + React        │    Single JAR deployment
                 │ (one JAR)      │
                 │ Java 17        │
                 └───────┬────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐  ┌───▼────┐  ┌─▼──────────┐
         │  Auth  │  │ CRUD   │  │ Event Store │
         │  JWT   │  │ API    │  │ (Redis +    │
         │        │  │        │  │  Postgres)  │
         └────────┘  └────────┘  └─────────────┘
                         │
              HTTP REST + SSE (with Last-Event-ID)
                         │
┌────────────────────────▼─────────────────────────────────────────────┐
│                Python FastAPI  (MAF Engine)                          │
│                                                                      │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────────┐   │
│  │ Agent Factory│  │ Workflow Runner │  │ AG-UI Streaming Layer │   │
│  │ (from config)│  │ Sequential      │  │ thinking / tool_call  │   │
│  │              │  │ Concurrent      │  │ step_start / progress │   │
│  │              │  │ Handoff         │  │ hitl_request          │   │
│  │              │  │ GroupChat       │  └───────────────────────┘   │
│  │              │  │ Magentic        │                              │
│  │              │  │ Declarative     │  ┌───────────────────────┐   │
│  └──────────────┘  └────────────────┘  │ DurableTask Worker    │   │
│                                        │ (long-running jobs)   │   │
│  ┌──────────────┐  ┌────────────────┐  └───────────────────────┘   │
│  │ Mem0 Context │  │ Tool Registry  │                               │
│  │ Provider     │  │ MCP / Function │  ┌───────────────────────┐   │
│  │ (per user)   │  │ OpenAPI        │  │ Event Journal         │   │
│  └──────────────┘  └────────────────┘  │ (seq ID → Redis)     │   │
│                                        └───────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────────┐
│              PostgreSQL + Redis                                       │
│  users │ sessions │ messages │ agents │ workflows │ runs             │
│  events │ checkpoints │ user_memory │ templates                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Why 3 Services
- **React** — visual layer, no business logic
- **Java (Spring Boot 3 / Java 17)** — config management, persistence, auth, run orchestration;
  React static files embedded here for single-JAR deployment
- **Python (FastAPI + MAF)** — MAF runs only in Python; isolated so it scales independently

---

## Core Data Models

### Database Schema

```sql
-- Users & Auth
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR,
  preferences_json JSONB,
  created_at TIMESTAMP
)

-- Sessions (user-scoped conversation context)
sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR,
  workflow_id UUID,
  created_at TIMESTAMP,
  last_active_at TIMESTAMP
)

-- Conversation history
messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  run_id UUID,
  role VARCHAR,          -- user | agent | system
  content TEXT,
  metadata_json JSONB,
  sequence_id BIGINT,
  created_at TIMESTAMP
)

-- User memory (cross-session)
user_memory (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  key VARCHAR,
  value TEXT,
  embedding VECTOR,
  updated_at TIMESTAMP
)

-- Agent configurations
agents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR,
  instructions TEXT,
  provider VARCHAR,       -- openai | anthropic | azure | gemini | ollama
  model VARCHAR,
  tools_json JSONB,
  skills_json JSONB,
  middleware_json JSONB,
  memory_enabled BOOLEAN DEFAULT true,
  run_mode VARCHAR,       -- interactive | background
  max_run_duration_minutes INT DEFAULT 30,
  metadata_json JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Workflow configurations
workflows (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR,
  description TEXT,
  orchestration_type VARCHAR, -- sequential|concurrent|handoff|groupchat|magentic|declarative
  graph_json JSONB,           -- ReactFlow nodes + edges
  yaml_content TEXT,          -- Generated MAF declarative YAML
  is_template BOOLEAN DEFAULT false,
  template_category VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Execution runs
runs (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  workflow_id UUID REFERENCES workflows(id),
  user_id UUID REFERENCES users(id),
  status VARCHAR,             -- queued|running|paused_hitl|completed|failed|cancelled
  job_type VARCHAR,           -- interactive | background
  last_event_seq BIGINT,
  checkpoint_data JSONB,
  input_json JSONB,
  output_json JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  estimated_duration_minutes INT
)

-- Event journal (for replay on reconnect)
run_events (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES runs(id),
  sequence_id BIGINT,         -- monotonic per run, used for replay
  event_type VARCHAR,         -- thinking|tool_call|tool_result|step_start|
                              -- step_end|agent_message|hitl_request|
                              -- progress|error|completed
  payload_json JSONB,
  created_at TIMESTAMP
)
```

### Agent Config JSON
```json
{
  "id": "uuid",
  "name": "Research Agent",
  "instructions": "You are a research specialist...",
  "provider": "openai | anthropic | azure | gemini | ollama",
  "model": "gpt-4o | claude-sonnet-4-6 | gemini-2.0-flash",
  "tools": [
    { "type": "function", "name": "web_search", "description": "..." },
    { "type": "mcp", "server": "brave-search", "tool": "search" },
    { "type": "openapi", "spec_url": "https://..." }
  ],
  "skills": ["research-kb", "document-parser"],
  "middleware": ["logging", "rate-limit"],
  "memory_enabled": true,
  "personalization_prompt": "User preferences: {user.preferences}",
  "max_run_duration_minutes": 60,
  "run_mode": "interactive | background"
}
```

### Workflow Config (YAML — MAF declarative, stored & executed)
```yaml
id: wf-uuid
name: Customer Support Pipeline
description: Multi-agent support with escalation
orchestration_type: declarative
agents:
  - ref: agent-uuid-1
    alias: service_agent
  - ref: agent-uuid-2
    alias: ticket_agent
actions:
  - kind: InvokeAgent
    id: step1
    agent: service_agent
    ...
```

### Visual Graph JSON (stored alongside YAML)
```json
{
  "nodes": [
    { "id": "n1", "type": "start",     "position": { "x": 0,   "y": 0 } },
    { "id": "n2", "type": "agent",     "position": { "x": 200, "y": 0 },
      "data": { "agent_id": "uuid", "alias": "researcher" } },
    { "id": "n3", "type": "condition", "position": { "x": 400, "y": 0 },
      "data": { "expression": "=Local.IsResolved" } },
    { "id": "n4", "type": "end",       "position": { "x": 600, "y": 0 } }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" },
    { "id": "e2", "source": "n2", "target": "n3" },
    { "id": "e3", "source": "n3", "target": "n4", "label": "resolved" }
  ]
}
```

---

## Workflow Types Supported

| Type        | MAF Class           | Description                                              |
|-------------|---------------------|----------------------------------------------------------|
| Sequential  | `SequentialBuilder` | Agents run in order, output passes forward               |
| Concurrent  | `ConcurrentBuilder` | Fan-out to all agents, aggregate results                 |
| Handoff     | `HandoffBuilder`    | Agents decide who handles next                           |
| Group Chat  | `GroupChatBuilder`  | Orchestrator selects next speaker                        |
| Magentic    | `MagenticBuilder`   | Manager + participants (Magentic One pattern)            |
| Declarative | `declarative` pkg   | Full YAML-defined logic: conditions, loops, sub-flows    |

---

## Streaming Event Taxonomy (AG-UI Protocol)

MAF's `ag-ui` package emits these events natively. The UI consumes them to drive all live displays:

| Event Type    | UI Renders                                                        |
|---------------|-------------------------------------------------------------------|
| thinking      | "Thinking..." pane with streaming tokens                          |
| planning      | Ordered step list: `[ ] Step 1  [✓] Step 2`                      |
| tool_call     | `"Calling: web_search('climate change 2025')"`                    |
| tool_result   | Collapsible result panel                                          |
| step_start    | Active node pulses/glows in workflow canvas                       |
| step_end      | Node turns green, next lights up                                  |
| agent_message | Chat bubble from agent                                            |
| hitl_request  | Modal overlay — user must respond to continue                     |
| progress      | Progress bar + `"Step 3 of 7: Analyzing results"`                 |
| error         | Red banner + details                                              |
| completed     | Summary + download link (for long runs)                           |

---

## Multi-turn Chat + Memory Flow

```
User types message
       │
       ▼
Java API: attach to session → load history (last N messages) + user memory
       │
       ▼
Python MAF Engine:
  1. Inject user memory via Mem0ContextProvider
  2. Inject conversation history as message thread
  3. Inject user preferences into system prompt
  4. Execute agent/workflow
  5. Stream AG-UI events back (thinking → tool → response)
  6. After completion: update mem0 memory for user
       │
       ▼
Java API: persist new message to messages table
       │
       ▼
React: append chat bubble + replay thinking/tool events in side panel
```

---

## Long-Running Agent Architecture

```
Short run (< 2 min)            Long run (report generation, research)
────────────────────           ─────────────────────────────────────
Direct async execution          MAF DurableTask worker
SSE streams response            Job queued in Redis
User stays on page              User gets job_id immediately
                                Can close browser → job continues
                                Notification pushed on completion
                                Results stored, downloadable
                                Can reconnect and "watch" at any time
```

**Python Engine — Job routing:**
```
POST /execute
  → if run_mode == "interactive": run inline, stream SSE
  → if run_mode == "background":  enqueue to DurableTask, return {job_id}

GET  /execute/{run_id}/stream   → SSE (supports Last-Event-ID replay)
GET  /execute/{run_id}/status   → current status + progress %
POST /execute/{run_id}/cancel
POST /execute/{run_id}/hitl     → resume from HITL pause
```

---

## Flaky Connectivity — Recovery Design

### Strategy: Event Journal + SSE Replay

Every event emitted by the Python engine is:
1. Written to `run_events` table with a monotonic `sequence_id`
2. Cached in Redis (TTL 24h) for fast replay
3. Sent over SSE with `id: {sequence_id}`

**Client (React):**
- On connect: sends `Last-Event-ID` header (EventSource does this automatically)
- On reconnect: exponential backoff (1s → 2s → 4s → 8s → max 30s)
- Shows `"Connection lost — reconnecting..."` banner
- On success: server replays all missed events from `last_seq + 1`

**Server (Java → SSE):**
- On reconnect with `Last-Event-ID`: query `run_events WHERE sequence_id > ?`
- Replay stored events immediately, then tail live events
- Long-running job continues in Python regardless of client state

**Key point:** The long-running Python job is never tied to the HTTP connection. It persists
via DurableTask and Redis. The client can drop and reconnect at any time.

---

## Deployment

### Single JAR: React + Spring Boot (Java 17)

```
mas-platform/
├── backend-api/                        ← Spring Boot (Java 17) project
│   ├── pom.xml                         ← frontend-maven-plugin configured here
│   └── src/main/
│       ├── java/...                    ← Spring Boot source
│       └── resources/static/           ← React build output lands here
└── frontend/                           ← React source
    ├── package.json
    └── src/...
```

**pom.xml (key sections):**
```xml
<properties>
  <java.version>17</java.version>
</properties>

<!-- Build React and copy output -->
<plugin>
  <groupId>com.github.eirslett</groupId>
  <artifactId>frontend-maven-plugin</artifactId>
  <configuration>
    <workingDirectory>../frontend</workingDirectory>
  </configuration>
  <executions>
    <execution><goals><goal>install-node-and-npm</goal></goals></execution>
    <execution><goals><goal>npm</goal></goals>
      <configuration><arguments>run build</arguments></configuration>
    </execution>
  </executions>
</plugin>

<plugin>
  <artifactId>maven-resources-plugin</artifactId>
  <executions>
    <execution>
      <phase>process-resources</phase>
      <configuration>
        <outputDirectory>${project.build.outputDirectory}/static</outputDirectory>
        <resources>
          <resource><directory>../frontend/dist</directory></resource>
        </resources>
      </configuration>
    </execution>
  </executions>
</plugin>
```

**Spring Boot — serve React SPA (Java 17):**
```java
@Controller
public class SpaController {
    @GetMapping(value = "/{path:[^\\.]*}")
    public String forward() {
        return "forward:/index.html";
    }
}
```

**Build and run:**
```bash
mvn clean package        # builds React + Spring Boot → single JAR
java -jar target/mas-platform.jar
# React served on /
# API served on /api/*
```

### Python App (separate)
```bash
uvicorn main:app --host 0.0.0.0 --port 8001
# or: gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

---

## Project Structure (Monorepo)

```
mas-platform/
├── PLAN.md                             ← this file
├── docker-compose.yml
├── database/
│   └── schema.sql
│
├── frontend/                           ← React (Vite + TypeScript)
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── builder/                ← Visual workflow builder
│       │   │   ├── Canvas.tsx                  ReactFlow canvas
│       │   │   ├── NodePalette.tsx             Draggable node types
│       │   │   ├── NodeTypes/
│       │   │   │   ├── AgentNode.tsx
│       │   │   │   ├── ConditionNode.tsx
│       │   │   │   ├── LoopNode.tsx
│       │   │   │   ├── ToolNode.tsx
│       │   │   │   ├── HITLNode.tsx
│       │   │   │   ├── ParallelForkNode.tsx
│       │   │   │   ├── ParallelJoinNode.tsx
│       │   │   │   ├── SubWorkflowNode.tsx
│       │   │   │   └── StartEndNode.tsx
│       │   │   ├── EdgeTypes/                  Conditional edges
│       │   │   ├── PropertiesPanel.tsx         Selected node config
│       │   │   └── YAMLPreview.tsx             Live YAML preview (Monaco)
│       │   ├── chat/                   ← Multi-turn session chat
│       │   │   ├── ChatWindow.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   ├── ThinkingPanel.tsx           Planning/thinking display
│       │   │   └── SessionSidebar.tsx
│       │   ├── agents/                 ← Agent management
│       │   ├── runtime/                ← Execution console + logs
│       │   ├── templates/              ← Template gallery
│       │   └── monitoring/             ← Observability dashboard
│       ├── store/                      ← Zustand state
│       ├── api/                        ← API client (Java backend)
│       └── utils/
│           ├── graphToYaml.ts          ← Visual graph → MAF YAML
│           └── yamlToGraph.ts          ← MAF YAML → visual graph (import)
│
├── backend-api/                        ← Java 17 + Spring Boot 3
│   ├── pom.xml
│   └── src/main/java/com/masplatform/
│       ├── MasPlatformApplication.java
│       ├── auth/                       ← JWT auth
│       ├── agents/                     ← Agent CRUD
│       ├── workflows/                  ← Workflow CRUD + YAML store
│       ├── sessions/                   ← Session + message management
│       ├── runs/                       ← Run management + event store
│       ├── templates/                  ← Template registry
│       ├── gateway/                    ← WebSocket + SSE proxy to Python
│       ├── web/
│       │   └── SpaController.java      ← Serves React index.html
│       └── config/
│
└── execution-engine/                   ← Python 3.11 + FastAPI + MAF
    ├── main.py
    ├── requirements.txt
    ├── routers/
    │   ├── execute.py                  ← POST /execute, GET /{id}/stream
    │   ├── agents.py                   ← Agent validation
    │   └── health.py
    └── engine/
        ├── agent_factory.py            ← Build MAF Agent from config dict
        ├── workflow_runner.py          ← Route to correct builder
        ├── orchestrations/
        │   ├── sequential.py
        │   ├── concurrent.py
        │   ├── handoff.py
        │   ├── groupchat.py
        │   └── magentic.py
        ├── declarative.py              ← YAML declarative runner
        ├── memory.py                   ← Mem0ContextProvider wiring
        ├── jobs.py                     ← DurableTask background jobs
        ├── event_journal.py            ← Sequence ID + Redis write
        └── tool_registry.py            ← MCP / function / OpenAPI tools
```

---

## API Contracts

### Java Spring Boot API (`/api/*`)

```
# Auth
POST    /api/auth/register
POST    /api/auth/login
POST    /api/auth/refresh

# Users
GET     /api/users/me
PUT     /api/users/me/preferences

# Sessions
GET     /api/sessions                       List user's sessions
POST    /api/sessions                       Create session
GET     /api/sessions/{id}                  Get session + recent messages
DELETE  /api/sessions/{id}
GET     /api/sessions/{id}/messages         Paginated message history

# Agents
GET     /api/agents
POST    /api/agents
GET     /api/agents/{id}
PUT     /api/agents/{id}
DELETE  /api/agents/{id}

# Workflows
GET     /api/workflows
POST    /api/workflows                      Create (graph JSON → also generates YAML)
GET     /api/workflows/{id}
PUT     /api/workflows/{id}
DELETE  /api/workflows/{id}
GET     /api/workflows/{id}/yaml            Export YAML
POST    /api/workflows/import               Import YAML → generate graph

# Templates
GET     /api/templates                      Template gallery (filterable)
POST    /api/templates                      Save workflow as template
POST    /api/templates/{id}/instantiate     New workflow from template

# Runs
POST    /api/runs                           Start run {workflow_id, session_id, inputs}
GET     /api/runs/{id}                      Status + metadata
GET     /api/runs/{id}/stream               SSE stream (supports Last-Event-ID)
POST    /api/runs/{id}/hitl                 Submit HITL response
POST    /api/runs/{id}/cancel
GET     /api/runs                           Run history (filterable by session/workflow)

# WebSocket
WS      /ws/runs/{id}                       Live run updates
```

### Python MAF Engine API

```
POST    /execute                            Start workflow execution
GET     /execute/{run_id}/stream            SSE event stream (Last-Event-ID supported)
GET     /execute/{run_id}/status            Current status + progress %
POST    /execute/{run_id}/hitl              Resume from HITL checkpoint
POST    /execute/{run_id}/cancel
POST    /agents/validate                    Validate agent config JSON
GET     /health
```

---

## UI — What the User Sees

### Chat + Session View
```
┌──────────────────────────────────────────────────────────────┐
│ Session: "Q3 Research Project"          [New Session] [Runs]  │
├──────────────────────────────────────────────────────────────┤
│  You: Analyze competitor landscape for Q3                    │
│                                                              │
│  ┌─ Agent Thinking ──────────────────────────────────────┐  │
│  │ Planning...                                            │  │
│  │  ✓ 1. Search for competitors                          │  │
│  │  ↻ 2. Analyze each competitor's positioning           │  │
│  │  ○ 3. Synthesize findings                             │  │
│  │                                                        │  │
│  │  Calling: web_search("top SaaS competitors Q3 2025")  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Agent: Based on my research, here are the top 5...          │
│                                                              │
│  You: Focus on pricing strategies                            │
│  Agent: [streaming response...]                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Type a message...]                          [Send] [Run ▶] │
└──────────────────────────────────────────────────────────────┘
```

### Workflow Builder
```
┌─────────────┬──────────────────────────────────────┬──────────┐
│ Node Palette│          Canvas                       │ Config   │
│             │                                       │ Panel    │
│ ○ Start     │  ○──→ [Researcher]──→ ◇──→ [Writer]  │          │
│ □ Agent     │               active▲      ↓          │ Agent:   │
│ ◇ Condition │               (glow)  [HITL] waiting  │ Researcher│
│ ⟲ Loop      │                           ↓           │          │
│ ⇉ Parallel  │                      [Publisher]──→ ● │ Model:   │
│ ! HITL      │                                       │ gpt-4o   │
│ ◫ Sub-flow  │                                       │          │
│ ● End       │                                       │ Tools:   │
│             │  [▶ Run] [Export YAML] [Save Template] │ + web   │
└─────────────┴──────────────────────────────────────┴──────────┘
```

### Long-Running Job Status
```
┌──────────────────────────────────────────────────────────────┐
│ Run: "Q3 Competitor Report"          Status: Running  [×]    │
│ Started: 14:32   Estimated: ~45 min                          │
│                                                              │
│ ████████████░░░░░░░░░░  55%                                  │
│ Step 4 of 7: Analyzing financial data                        │
│                                                              │
│ [View Live Log]  [Cancel]  [Notify on completion ✓]         │
│                                                              │
│  ⚠ Connection lost — reconnecting...  (reconnected at 14:38) │
└──────────────────────────────────────────────────────────────┘
```

---

## Visual Node Types

| Node Type      | Visual       | Maps To in MAF                          |
|----------------|--------------|-----------------------------------------|
| Start          | Green circle | Workflow entry point                    |
| Agent          | Blue rect    | MAF `Agent` instance                    |
| Tool           | Orange diamond | Function / MCP / OpenAPI tool         |
| Condition      | Yellow rhombus | `ConditionGroup` / edge condition     |
| Loop           | Purple arrows | Loop with configurable exit condition  |
| Parallel Fork  | Split arrows | `ConcurrentBuilder` fan-out             |
| Parallel Join  | Merge arrows | Aggregate concurrent results            |
| HITL           | Red pause    | Human-in-the-loop checkpoint            |
| Sub-Workflow   | Nested box   | Another workflow as executor            |
| End            | Red circle   | `EndWorkflow`                           |

---

## Technology Stack

| Layer            | Technology                                          | Why                                    |
|------------------|-----------------------------------------------------|----------------------------------------|
| Frontend         | React 18 + TypeScript + Vite                        | Modern, fast builds                    |
| Visual Builder   | ReactFlow                                           | Best-in-class graph editor             |
| UI Components    | shadcn/ui + Tailwind CSS                            | Clean, composable design system        |
| Code Editor      | Monaco Editor                                       | YAML preview + inline editing          |
| State            | Zustand + React Query                               | Local + server state                   |
| Realtime         | Browser EventSource (SSE) + WebSocket               | SSE for runs, WS for chat              |
| API Backend      | Java 17 + Spring Boot 3                             | Single JAR, enterprise-grade           |
| ORM              | Spring Data JPA + Hibernate                         | PostgreSQL access                      |
| Cache / Queue    | Redis                                               | Event journal, job queue, sessions     |
| Database         | PostgreSQL                                          | All persistent data                    |
| Execution Engine | Python 3.11 + FastAPI                               | MAF runs only in Python                |
| Agent Framework  | MAF: core + orchestrations + declarative + ag-ui + mem0 + durabletask | Full capability |
| Streaming        | AG-UI protocol (MAF native)                         | Thinking/planning/tool events          |
| Long-running     | MAF DurableTask                                     | State persistence + failure recovery   |
| Memory           | MAF Mem0                                            | Cross-session user memory              |
| Build (JAR)      | Maven + frontend-maven-plugin                       | React embedded in Spring Boot          |
| Containers       | Docker Compose (dev) → Azure Container Apps (prod)  | Local dev + Azure cloud deployment     |

---

## Build Phases

### Phase 1 — Foundation ✅ DONE
- [x] Monorepo: `frontend/`, `backend-api/`, `execution-engine/`
- [x] Docker Compose: PostgreSQL, Python engine, Java+React jar (no Redis — PostgreSQL only)
- [x] Database schema: all tables (users, sessions, messages, agents, workflows, runs, run_events, hitl_requests, templates)
- [x] Java 17: project skeleton, JWT auth, DB connection pools
- [x] Python: FastAPI skeleton, MAF installed, health endpoint, AG-UI setup
- [x] Maven plugin configured — single JAR build works end-to-end
- [x] React: Vite + TypeScript, layout shell, routing, API client + SSE client

### Phase 2 — User Sessions & Memory ✅ DONE
- [x] Java: User CRUD, JWT login/register, session CRUD
- [x] Python: conversation history injection (last N messages from session)
- [x] Java: message persistence after each turn
- [x] React: session list sidebar, session switcher, chat history display
- [x] React: user profile page (preferences, default model)

### Phase 3 — Agent Management ✅ DONE
- [x] Python: `agent_factory.py` builds MAF `Agent` from config JSON
- [x] Python: tool registry — calculator, datetime, file_reader; MCP + OpenAPI stubs
- [x] Java: Agent CRUD REST endpoints
- [x] React: Agent list, Agent editor (instructions, model, tools, run mode)
- [x] React: Agent test panel (single-turn test with thinking panel)

### Phase 4 — Workflow Builder UI ✅ DONE
- [x] React: ReactFlow canvas + all custom node types (Start, End, Agent, Condition, ParallelFork, ParallelJoin, HITL)
- [x] React: Node palette with drag-onto-canvas
- [x] React: Properties panel per node type
- [x] React: `graphToYaml.ts` — graph → MAF YAML (all 6 orchestration types)
- [x] React: Live YAML preview panel
- [x] Java: Workflow CRUD (store graph JSON + YAML)
- [x] React: Orchestration type switcher (Sequential/Concurrent/Handoff/GroupChat/Magentic/Declarative)

### Phase 5 — Execution Engine ✅ DONE
- [x] Python: `workflow_runner.py` routes by `orchestration_type`
- [x] Python: all 6 MAF orchestration builders wired up
- [x] Python: AG-UI event stream (thinking, tool_call, step_start, etc.)
- [x] Python: Event journal (every event → PostgreSQL run_events with seq_id)
- [x] Java: Run management, SSE proxy (Java tails DB ← Python writes)
- [x] Java: SSE replay on reconnect (`WHERE sequence_id > ?` via Last-Event-ID)
- [x] Java: JWT ?token= query param fallback for browser EventSource
- [x] React: ThinkingPanel — streaming thinking/tool events, collapsible

### Phase 6 — Long-Running & HITL ✅ DONE
- [x] Python: Background jobs via `asyncio.create_task` with `asyncio.wait_for` timeout
- [x] Python: `/jobs` router — POST submit, GET status, DELETE cancel
- [x] Java: `fireBackgroundJob()` → Python /jobs; `fireEngine()` → Python /execute
- [x] React: BackgroundRunCard — live progress, cancel button
- [x] Python: HITL intercept → `hitl_requests` table → SSE `hitl_request` event
- [x] Java: `HitlRequest` entity, `RunController.submitHitl()` writes response to DB
- [x] React: HitlModal (pink overlay, blocks until submitted, Cmd+Enter shortcut)
- [x] React: Progress bar inline in chat from `progress` SSE events

### Phase 7 — Templates & Personalization ✅ DONE
- [x] Java: `Template` entity + `TemplateService` (seeds 3 built-ins on first boot)
- [x] Java: `TemplateController` — list/get/save-as-template
- [x] React: `Templates.tsx` — category filter, search, graph preview, use template modal
- [x] React: `yamlToGraph.ts` — YAML → ReactFlow graph (all 6 orchestration types)
- [x] React: YAML import modal in Workflow canvas (paste → replace canvas)
- [x] React: "Save as Template" button in canvas top bar
- [x] Python: `inject_memory_into_instructions()` injects user preferences into agent system prompts
- [x] React: Profile page — 7 personalization fields with hints (model, language, style, expertise, domain, tone, format)

### Phase 8 — UX Polish (In Progress)
- [ ] React: Markdown rendering in chat bubbles (react-markdown)
- [ ] Java/React: Session-to-workflow binding (launch specific workflow from session)
- [ ] React: Runs page improvements — filter by session, search, export

### Phase 9 — Production Hardening
- [ ] Java: Rate limiting (Bucket4j), circuit breaker to Python engine (Resilience4j)
- [ ] Java: Structured logging with correlation IDs (run_id, session_id in MDC)
- [ ] OpenTelemetry traces across Java ↔ Python (OTLP export)
- [ ] Python: Stateless engine design — all state in PostgreSQL (no in-process dict)
- [ ] Auth: workspace/org isolation (users only see own agents/workflows — already userId-scoped, add org layer)
- [ ] Python: Tool approval flow — agent pauses before calling tool (HITL variant)
- [ ] Python: Streaming token-by-token output (delta events)
- [ ] Python: Agent memory persistence (pgvector for cross-session memory)

### Phase 10 — Azure Container Apps Deployment
- [ ] Azure Container Registry — push Java JAR image + Python image
- [ ] Bicep templates — ACA environment, Java app, Python app, PostgreSQL Flexible Server
- [ ] Managed identity — no secrets in env vars, use Azure Key Vault references
- [ ] ACA scaling rules — HTTP for Java API, CPU for Python engine
- [ ] GitHub Actions CI/CD pipeline — build → push → deploy on main merge
- [ ] Custom domain + managed TLS on ACA ingress
- [ ] Azure Monitor + Application Insights wired to OpenTelemetry

---

## Complete Execution Flow

```
User sends message in session
  │
  ├─ Java: load session, history (last 20 msgs), user memory, preferences
  ├─ Java: create run record (status=queued)
  ├─ Java: POST /execute to Python engine (config + history + memory)
  │
  └─ Python engine:
       ├─ Build agents from config via agent_factory
       ├─ Inject mem0 context + conversation history
       ├─ Inject personalization into system prompt
       ├─ If interactive: run inline → stream SSE
       │     Every event → write to run_events(seq_id) → Redis → SSE
       ├─ If background: enqueue DurableTask → return job_id immediately
       │
       ├─ AG-UI events flow:
       │   thinking → planning → tool_call → tool_result
       │   → step_start → agent_message → step_end → completed
       │
       ├─ If HITL node reached:
       │   → emit hitl_request event → save checkpoint
       │   → Java notifies React → user fills form → Java POSTs /hitl
       │   → Python resumes from checkpoint
       │
       └─ On completion:
            → update mem0 memory for user
            → Java stores final message in messages table
            → React shows response + collapses thinking panel
```

---

## MAF Python Packages Used

| Package                          | Purpose                                      |
|----------------------------------|----------------------------------------------|
| `agent-framework-core`           | Core Agent class, tools, providers           |
| `agent-framework-orchestrations` | Sequential, Concurrent, Handoff, GroupChat, Magentic builders |
| `agent-framework-declarative`    | YAML-based workflow execution                |
| `agent-framework-ag-ui`          | Streaming event protocol (thinking/planning/tools) |
| `agent-framework-mem0`           | Cross-session user memory                    |
| `agent-framework-durabletask`    | Long-running job persistence + recovery      |
| `agent-framework-openai`         | OpenAI / Azure OpenAI chat client            |
| `agent-framework-anthropic`      | Anthropic Claude chat client                 |
| `agent-framework-gemini`         | Google Gemini chat client                    |
| `agent-framework-ollama`         | Local Ollama model support                   |

---

*Last updated: 2026-05-16 | Java version: 17 | MAF Python: latest pre-release*
