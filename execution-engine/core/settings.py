from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    environment: str = "development"

    host: str = "0.0.0.0"
    port: int = 8001

    # CORS
    cors_origins: List[str] = ["http://localhost:8080", "http://localhost:5173"]

    # PostgreSQL — asyncpg uses postgresql:// (not postgresql+asyncpg://)
    database_url_sync: str = "postgresql://mas:mas@localhost:5432/mas_platform"

    # LLM providers
    # Azure OpenAI
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-02-01"

    # Databricks (OpenAI-compatible endpoint)
    databricks_host: str = ""      # e.g. https://adb-xxx.azuredatabricks.net
    databricks_token: str = ""     # personal access token

    # Optional extras
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    # Internal
    java_backend_url: str = "http://localhost:8080"
    internal_api_key: str = "change-me-in-production"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
