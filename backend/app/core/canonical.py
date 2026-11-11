"""Canonical CSV bytes and the dataset hash (SPEC 5.4).

Fixed column order, comma separator, \\n line endings, UTF-8 without BOM,
csv.QUOTE_MINIMAL. These exact bytes are what the CSV endpoints serve, so the
hash inside a badge provably matches the files the candidate downloaded.
"""

from __future__ import annotations

import csv
import hashlib
import io

RECORD_SEPARATOR = b"\x1e"


def canonical_csv_bytes(columns: list[str], rows: list[list[str]]) -> bytes:
    buf = io.StringIO(newline="")
    writer = csv.writer(buf, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(columns)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode("utf-8")


def dataset_hash(pos: bytes, waybills: bytes, bank: bytes) -> str:
    digest = hashlib.sha256(
        pos + RECORD_SEPARATOR + waybills + RECORD_SEPARATOR + bank
    ).hexdigest()
    return f"sha256:{digest}"
