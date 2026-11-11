"""Issuer key management (SPEC 5.6).

Load ISSUER_PRIVATE_KEY_B64; if missing, generate a key, write it to keys/issuer.key
and log a warning telling the operator to copy it into the host env so badges keep
verifying across restarts.
"""

from __future__ import annotations

import base64
import logging
import os
from functools import lru_cache
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

from app.config import get_settings

log = logging.getLogger("reconcore.keys")

KEY_DIR = Path(__file__).resolve().parents[2] / "keys"
KEY_PATH = KEY_DIR / "issuer.key"


def _private_bytes(key: Ed25519PrivateKey) -> bytes:
    return key.private_bytes(
        encoding=Encoding.Raw, format=PrivateFormat.Raw, encryption_algorithm=NoEncryption()
    )


def public_key_bytes(key: Ed25519PublicKey) -> bytes:
    return key.public_bytes(encoding=Encoding.Raw, format=PublicFormat.Raw)


@lru_cache
def load_or_create_issuer_key() -> Ed25519PrivateKey:
    settings = get_settings()
    raw_b64 = settings.issuer_private_key_b64.strip() or os.environ.get(
        "ISSUER_PRIVATE_KEY_B64", ""
    ).strip()
    if raw_b64:
        try:
            raw = base64.b64decode(raw_b64, validate=True)
        except Exception as exc:  # pragma: no cover - operator error
            raise RuntimeError(
                "ISSUER_PRIVATE_KEY_B64 is not valid base64"
            ) from exc
        if len(raw) != 32:
            raise RuntimeError(
                f"ISSUER_PRIVATE_KEY_B64 must decode to 32 raw bytes, got {len(raw)}"
            )
        return Ed25519PrivateKey.from_private_bytes(raw)

    if KEY_PATH.exists():
        raw = base64.b64decode(KEY_PATH.read_text().strip(), validate=True)
        return Ed25519PrivateKey.from_private_bytes(raw)

    key = Ed25519PrivateKey.generate()
    encoded = base64.b64encode(_private_bytes(key)).decode()
    KEY_DIR.mkdir(parents=True, exist_ok=True)
    KEY_PATH.write_text(encoded + "\n")
    try:
        os.chmod(KEY_PATH, 0o600)
    except OSError:  # pragma: no cover - Windows/WSL filesystems
        pass
    log.warning(
        "No ISSUER_PRIVATE_KEY_B64 set. Generated a new issuer key at %s. "
        "Copy this into the host environment as ISSUER_PRIVATE_KEY_B64 so issued "
        "badges keep verifying after a restart: %s",
        KEY_PATH,
        encoded,
    )
    return key


def issuer_private_key() -> Ed25519PrivateKey:
    return load_or_create_issuer_key()


def issuer_public_key() -> Ed25519PublicKey:
    return load_or_create_issuer_key().public_key()
