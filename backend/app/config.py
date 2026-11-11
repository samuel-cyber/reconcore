"""Application settings, read from the environment / .env (SPEC 5.2)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    llm_model: str = "gemini/gemini-2.5-flash"
    gemini_api_key: str = ""
    openai_api_key: str = ""
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
    def llm_available(self) -> bool:
        """True when some provider key is present; the tutor/brief still fall back on error."""
        import os

        return bool(
            self.gemini_api_key
            or self.openai_api_key
            or os.environ.get("ANTHROPIC_API_KEY")
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
