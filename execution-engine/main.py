from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routers import health, execute, agents, jobs
from core.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"MAS Execution Engine starting — environment: {settings.environment}")
    yield
    print("MAS Execution Engine shutting down")


app = FastAPI(
    title="MAS Execution Engine",
    description="Microsoft Agent Framework execution engine for the MAS Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(execute.router, prefix="/execute")
app.include_router(agents.router, prefix="/agents")
app.include_router(jobs.router,   prefix="/jobs")
