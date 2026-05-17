# MAS Platform

A visual, config-driven platform for building and running multi-agent AI workflows.

**Stack:** React 18 + Java 17 Spring Boot 3 (single JAR) + Python 3.11 FastAPI (Microsoft Agent Framework) + PostgreSQL 16

---

## Architecture

```
Browser (React)  ──►  Java API :8080  ──►  Python Engine :8001
                            │                      │
                            └──────────────────────┘
                                    PostgreSQL :5432
```

- **Frontend** — React + Vite + ReactFlow + TailwindCSS, served from the Java JAR in production
- **Backend API** — Spring Boot 3, handles auth (JWT), sessions, workflows, agents, rate limiting, circuit breaker
- **Execution Engine** — FastAPI, runs MAF (Microsoft Agent Framework) agents, writes events to `run_events` table
- **Database** — PostgreSQL 16 + pgvector, schema managed by Flyway / validated on startup

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | 4.x+ | https://www.docker.com/products/docker-desktop |
| Java JDK | 17+ | `brew install openjdk@17` or https://adoptium.net |
| Maven | 3.9+ | `brew install maven` |
| Node.js | 20+ | `brew install node` or https://nodejs.org |
| Python | 3.11+ | `brew install python@3.11` |

> **Quickest path:** Docker Compose starts everything (Postgres + Engine + Java API). You only need Java/Maven/Node/Python for running services locally outside Docker.

---

## Option A — Full Docker Compose (Recommended for first run)

### 1. Create a `.env` file

```bash
cp .env.example .env   # if it exists, otherwise create it
```

Or create `.env` manually in the project root:

```env
# Required for LLM calls — add at least one provider
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-02-01

# Optional extra providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DATABRICKS_HOST=
DATABRICKS_TOKEN=

# Security (change these)
JWT_SECRET=change-me-in-production-use-256-bit-key
INTERNAL_API_KEY=change-me-internal
```

### 2. Build the Java JAR (Docker build needs it)

```bash
cd backend-api
mvn package -DskipTests
cd ..
```

### 3. Start everything

```bash
docker compose up --build
```

Services:

| Service | URL |
|---|---|
| App (React + API) | http://localhost:8080 |
| Execution Engine | http://localhost:8001 |
| PostgreSQL | localhost:5432 |

### 4. Stop

```bash
docker compose down          # keep data
docker compose down -v       # also wipe the database volume
```

---

## Option B — Local Dev (each service separately)

Run each service in its own terminal. Services start in this order: **Postgres → Engine → Java API → Frontend**.

### Step 1 — Start PostgreSQL

```bash
docker compose up postgres -d
```

Postgres will be ready at `localhost:5432` with database `mas_platform`, user `mas`, password `mas`.

### Step 2 — Start the Python Execution Engine

```bash
cd execution-engine

# First time only — create virtual environment and install deps
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create a .env file for the engine (copy and edit)
cat > .env <<'EOF'
ENVIRONMENT=development
DATABASE_URL_SYNC=postgresql://mas:mas@localhost:5432/mas_platform
JAVA_BACKEND_URL=http://localhost:8080
INTERNAL_API_KEY=change-me-internal

# Add at least one LLM provider
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-02-01

# Optional
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
EOF

# Start the engine
source .venv/bin/activate   # if not already active
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Engine API docs: http://localhost:8001/docs

### Step 3 — Start the Java API

```bash
cd backend-api

# Copy and edit application properties if needed
# Defaults work if Postgres is on localhost:5432 with user/pass mas/mas

mvn spring-boot:run \
  -Dspring-boot.run.jvmArguments="-DENGINE_URL=http://localhost:8001 -DINTERNAL_API_KEY=change-me-internal -DJWT_SECRET=change-me-local"
```

Or set environment variables instead:

```bash
export ENGINE_URL=http://localhost:8001
export INTERNAL_API_KEY=change-me-internal
export JWT_SECRET=change-me-local

cd backend-api
mvn spring-boot:run
```

Java API: http://localhost:8080/api

### Step 4 — Start the Frontend (dev server with hot reload)

```bash
cd frontend
npm install          # first time only
npm run dev
```

Frontend: http://localhost:5173

> The frontend dev server proxies `/api/**` to `http://localhost:8080` automatically (configured in `vite.config.ts`).

---

## Environment Variables Reference

### Java API (`backend-api`)

| Variable | Default | Description |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/mas_platform` | PostgreSQL JDBC URL |
| `DB_USERNAME` | `mas` | DB user |
| `DB_PASSWORD` | `mas` | DB password |
| `JWT_SECRET` | `change-me-in-production-use-256-bit-key` | HMAC-SHA256 key for JWT |
| `JWT_EXPIRATION_MS` | `86400000` | Token TTL (24 h) |
| `ENGINE_URL` | `http://localhost:8001` | Python engine base URL |
| `INTERNAL_API_KEY` | `change-me-in-production` | Shared secret between Java and Python |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8080` | Allowed CORS origins |
| `RATE_LIMIT_ENABLED` | `true` | Toggle rate limiting |
| `RATE_LIMIT_CHAT` | `10` | Chat requests per user per minute |
| `RATE_LIMIT_GENERAL` | `100` | General API requests per user per minute |

### Python Engine (`execution-engine`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL_SYNC` | `postgresql://mas:mas@localhost:5432/mas_platform` | PostgreSQL connection |
| `JAVA_BACKEND_URL` | `http://localhost:8080` | Java API base URL |
| `INTERNAL_API_KEY` | `change-me-in-production` | Must match Java API value |
| `AZURE_OPENAI_API_KEY` | _(empty)_ | Azure OpenAI key |
| `AZURE_OPENAI_ENDPOINT` | _(empty)_ | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_VERSION` | `2024-02-01` | API version |
| `OPENAI_API_KEY` | _(empty)_ | OpenAI key (optional) |
| `ANTHROPIC_API_KEY` | _(empty)_ | Anthropic key (optional) |
| `DATABRICKS_HOST` | _(empty)_ | Databricks workspace URL |
| `DATABRICKS_TOKEN` | _(empty)_ | Databricks PAT |

---

## Common Issues

**`relation "xxx" does not exist` on Java startup**
The schema wasn't applied. Restart Postgres with the volume mount:
```bash
docker compose down -v && docker compose up postgres -d
```

**`CallNotPermittedException` / circuit breaker open**
The Python engine is unreachable or returning errors. Check engine logs:
```bash
docker compose logs execution-engine -f
# or locally:
# check terminal where uvicorn is running
```

**`429 Too Many Requests`**
You've exceeded the per-user rate limit. Default: 10 chat req/min, 100 general req/min. Override with `RATE_LIMIT_CHAT` / `RATE_LIMIT_GENERAL`.

**Frontend build fails with `Cannot find module '@/...'`**
Run `npm run build` from the `frontend/` directory. Make sure `tsconfig.app.json` has the `paths` alias:
```json
"paths": { "@/*": ["./src/*"] }
```

**Port conflicts**
Check what's using a port:
```bash
lsof -i :8080    # or :5173, :8001, :5432
```

---

## Building for Production

```bash
# 1. Build the React app
cd frontend
npm run build          # outputs to frontend/dist/

# 2. Copy static assets into the Spring Boot resources folder
cp -r dist/* ../backend-api/src/main/resources/static/

# 3. Build the fat JAR
cd ../backend-api
mvn package -DskipTests

# 4. Run the self-contained JAR
java -jar target/mas-platform-*.jar
# App available at http://localhost:8080
```

Or build everything with Docker:

```bash
docker compose build
docker compose up
```

---

## Project Structure

```
mas-platform/
├── docker-compose.yml          # Full stack orchestration
├── .env                        # Local secrets (not committed)
│
├── frontend/                   # React + Vite app
│   ├── src/
│   │   ├── pages/              # Route-level pages
│   │   ├── components/         # Shared UI components
│   │   └── api/                # Axios API clients
│   └── package.json
│
├── backend-api/                # Spring Boot 3 (Java 17)
│   ├── src/main/java/com/masplatform/
│   │   ├── config/             # Security, CORS, rate limiting, circuit breaker
│   │   ├── session/            # Chat, sessions, messages
│   │   ├── workflow/           # Workflow CRUD
│   │   ├── agent/              # Agent CRUD
│   │   ├── run/                # Run tracking & SSE events
│   │   ├── template/           # Built-in and user templates
│   │   └── user/               # Auth, user management
│   └── pom.xml
│
├── execution-engine/           # Python FastAPI (MAF)
│   ├── routers/                # /execute, /jobs, /agents, /health
│   ├── engine/                 # MAF orchestration logic
│   ├── core/                   # Settings, DB connection
│   └── main.py
│
└── database/
    └── schema.sql              # PostgreSQL schema (applied on first Postgres start)
```
