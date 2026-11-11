"""did:key identity for the issuer (SPEC 5.6).

multibase = "z" + base58btc(0xed 0x01 || 32-byte Ed25519 public key)
"""

from __future__ import annotations

import base58
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from app.config import get_settings
from app.credentials.keys import issuer_public_key, public_key_bytes
from app.schemas import IssuerProfile

ED25519_MULTICODEC = b"\xed\x01"


def multibase_from_public_key(pub: Ed25519PublicKey) -> str:
    return "z" + base58.b58encode(ED25519_MULTICODEC + public_key_bytes(pub)).decode()


def public_key_from_multibase(multibase: str) -> Ed25519PublicKey:
    if not multibase.startswith("z"):
        raise ValueError("multibase must be base58btc ('z' prefix)")
    decoded = base58.b58decode(multibase[1:])
    if not decoded.startswith(ED25519_MULTICODEC):
        raise ValueError("not an Ed25519 multicodec key")
    raw = decoded[len(ED25519_MULTICODEC) :]
    if len(raw) != 32:
        raise ValueError("Ed25519 public key must be 32 bytes")
    return Ed25519PublicKey.from_public_bytes(raw)


def issuer_did() -> str:
    return "did:key:" + multibase_from_public_key(issuer_public_key())


def verification_method() -> str:
    multibase = multibase_from_public_key(issuer_public_key())
    return f"did:key:{multibase}#{multibase}"


def issuer_profile() -> IssuerProfile:
    multibase = multibase_from_public_key(issuer_public_key())
    return IssuerProfile(
        id=f"did:key:{multibase}",
        name=get_settings().issuer_name,
        public_key_multibase=multibase,
        verification_method=f"did:key:{multibase}#{multibase}",
    )
