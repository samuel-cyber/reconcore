#!/usr/bin/env python3
"""Print a fresh Ed25519 issuer key for ISSUER_PRIVATE_KEY_B64.

Set the printed value in the host environment (Render -> Environment) BEFORE issuing
any badge you intend to verify later: the key is the issuer's identity, so replacing it
changes the did:key and every previously issued credential stops verifying.

    python3 scripts/generate_issuer_key.py            # new key
    python3 scripts/generate_issuer_key.py --show     # also show the current key's DID

The private key is printed once and never stored by this script.
"""

from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import base58  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402
from cryptography.hazmat.primitives.serialization import (  # noqa: E402
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

ED25519_MULTICODEC = b"\xed\x01"


def did_for(private_key: Ed25519PrivateKey) -> str:
    raw_public = private_key.public_key().public_bytes(
        encoding=Encoding.Raw, format=PublicFormat.Raw
    )
    multibase = "z" + base58.b58encode(ED25519_MULTICODEC + raw_public).decode()
    return f"did:key:{multibase}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--show",
        action="store_true",
        help="print the DID of the key the app would currently load, then exit",
    )
    args = parser.parse_args()

    if args.show:
        from app.credentials.did import issuer_profile

        profile = issuer_profile()
        print(f"current issuer DID : {profile.id}")
        print(f"verificationMethod : {profile.verification_method}")
        return

    key = Ed25519PrivateKey.generate()
    raw = key.private_bytes(
        encoding=Encoding.Raw,
        format=PrivateFormat.Raw,
        encryption_algorithm=NoEncryption(),
    )
    encoded = base64.b64encode(raw).decode()

    print("# Add this to the backend host environment (Render -> Environment):")
    print(f"ISSUER_PRIVATE_KEY_B64={encoded}")
    print()
    print(f"# This key issues badges as: {did_for(key)}")
    print("# Keep it secret. Anyone holding it can mint ReconCore credentials.")


if __name__ == "__main__":
    main()
