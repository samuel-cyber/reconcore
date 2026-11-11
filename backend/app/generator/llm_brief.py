"""The LLM-written manager's brief (SPEC 5.3).

The prompt contains no number from the answer. Any failure, any suspicious output, and
`brief.py` keeps its hand-written template.
"""

from __future__ import annotations

import logging

from app.tutor.llm import complete
from app.tutor.prompt import BRIEF_SYSTEM, BRIEF_USER

log = logging.getLogger("reconcore.brief")

MIN_WORDS = 90
MAX_WORDS = 260


def llm_brief_body() -> str | None:
    reply = complete(
        [
            {"role": "system", "content": BRIEF_SYSTEM},
            {"role": "user", "content": BRIEF_USER},
        ],
        max_tokens=420,
    )
    if reply is None:
        return None

    body = "\n\n".join(
        " ".join(part.split())
        for part in reply.text.strip().split("\n\n")
        if part.strip()
    )
    words = len(body.split())
    if not (MIN_WORDS <= words <= MAX_WORDS):
        log.warning(
            "brief from model=%s was %s words; keeping the template", reply.model, words
        )
        return None
    log.info("brief written by model=%s (%s words)", reply.model, words)
    return body
