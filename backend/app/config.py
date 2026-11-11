"""Application settings, read from the environment / .env (SPEC 5.2)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Primary provider: Meta's Model API (Muse Spark), spoken to over the OpenAI
    # chat-completions wire format via LiteLLM's "openai/" prefix.
    llm_model: str = "openai/muse-spark-1.1"
    llm_api_base: str = "https://api.meta.ai/v1"
    llm_api_key: str = ""
    llm_reasoning_effort: str = "minimal"

    # Optional second chance before the templates take over.
    llm_fallback_model: str = ""
    llm_fallback_api_base: str = "https://api.featherless.ai/v1"
    llm_fallback_api_key: str = ""

    llm_timeout_s: float = 5.0

    issuer_private_key_b64: str = ""
    issuer_name: str = "ReconCore"

    db_path: str = "./reconcore.db"
    cors_origins: str = "http://localhost:3000,https://reconcore.vercel.app"
    public_base_url: str = "http://localhost:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def primary_llm_configured(self) -> bool:
        return bool(self.llm_api_key and self.llm_model)

    @property
    def fallback_llm_configured(self) -> bool:
        return bool(self.llm_fallback_model and self.llm_fallback_api_key)

    @property
    def llm_available(self) -> bool:
        """True when some provider is configured. Says nothing about whether it works —
        `/health` reports that, and every call path falls back to templates anyway."""
        return self.primary_llm_configured or self.fallback_llm_configured


@lru_cache
def get_settings() -> Settings:
    return Settings()
