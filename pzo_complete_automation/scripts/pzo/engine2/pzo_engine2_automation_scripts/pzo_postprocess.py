#!/usr/bin/env python3
"""pzo_postprocess.py — sanitize model output into deployable code.

V2 IMPROVEMENTS over v1:
  - File-type aware: TypeScript/TSX, CSS, JSON — each has different preamble patterns
  - Smarter fence extraction: picks best block by language tag match
  - TODO detection exemption for CSS (/* TODO */ is a real comment pattern)
  - Minimum viable size checks scaled by task type
  - Detailed failure reasons for forensics log
  - Never corrupts CSS by stripping TypeScript-only patterns

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# ── Regex library ──────────────────────────────────────────────────────────────

_FENCE_RE = re.compile(r"```([a-zA-Z0-9_-]*)\n(.*?)\n```", re.DOTALL)
_LINE_NUM_RE = re.compile(r"^\s*\d+\s*:\s*")
_TODO_RE = re.compile(r"\b(TODO|FIXME|HACK|TO\s*DO)\b")

# LLM prose preambles to strip — language-agnostic
_PROSE_START_RE = re.compile(
    r"^\s*("
    r"Regarding\b|This\s+(TypeScript|CSS|file)\b|The\s+(TypeScript|file)\s+\w+\b|"
    r"In\s+this\s+(example|implementation)\b|Here(?:'s| is)\b|"
    r"Sure\b|Absolutely\b|Below\b|I\s+will\b|We\s+will\b|"
    r"Of\s+course\b|Let\s+me\b|As\s+requested\b|"
    r"Based\s+on\s+(the|your)\b|The\s+implementation\b"
    r")",
    re.IGNORECASE,
)

# Code-start signals — stop stripping when we hit these
_CODE_START_RE = re.compile(
    r"^\s*("
    r"import\b|export\b|class\b|interface\b|type\b|const\b|let\b|var\b|"
    r"function\b|async\b|describe\b|it\b|test\b|"   # TypeScript/JS
    r"\/\*|\/\/|#!|@|"                               # CSS comments / shebang / decorators
    r"\.|:root|html\b|body\b|\*\s*{|"               # CSS selectors
    r"\{|\["                                         # JSON
    r")"
)

# File extensions → language hints
_EXT_LANG = {
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".css":  "css",
    ".json": "json",
    ".js":   "javascript",
    ".jsx":  "javascript",
    ".md":   "markdown",
    ".sh":   "bash",
}


@dataclass(frozen=True)
class PostResult:
    ok:     bool
    text:   str
    reason: str = ""


def sanitize(raw: str, filename: str = "", task_type: str = "") -> PostResult:
    """Sanitize LLM output into deployable source code.

    Args:
        raw:       Raw text from Ollama.
        filename:  Target filename (used for language detection).
        task_type: From taskbook task_type field (used to adjust thresholds).

    Returns:
        PostResult with ok=True and clean text on success.
    """
    if not raw or not raw.strip():
        return PostResult(False, "", "empty_output")

    ext = ""
    if filename:
        for e in _EXT_LANG:
            if filename.endswith(e):
                ext = e
                break
    lang = _EXT_LANG.get(ext, "")

    # Normalize line endings
    s = raw.replace("\r\n", "\n").replace("\r", "\n")

    # ── Step 1: Try fenced block extraction ───────────────────────────────────
    fenced = _best_fence(s, lang)
    if fenced:
        s = fenced

    # ── Step 2: Strip prose preamble lines ────────────────────────────────────
    lines = s.split("\n")
    while lines:
        l0 = lines[0]
        stripped = l0.strip()
        if not stripped:
            lines.pop(0)
            continue
        if _CODE_START_RE.match(l0):
            break
        if _PROSE_START_RE.match(l0):
            lines.pop(0)
            continue
        break

    s = "\n".join(lines)

    # ── Step 3: Strip line-number prefixes (model sometimes adds "12: ...") ───
    cleaned = []
    for line in s.split("\n"):
        cleaned.append(_LINE_NUM_RE.sub("", line))
    s = "\n".join(cleaned).strip("\n") + "\n"

    # ── Step 4: TODO check (skip for pure CSS — /* TODO */ is fine there) ────
    if lang != "css" and task_type not in ("audit", "validation"):
        if _TODO_RE.search(s):
            return PostResult(False, s, "output_contains_TODO_or_FIXME — policy forbids incomplete code")

    # ── Step 5: Minimum size check ─────────────────────────────────────────────
    min_size = 10 if task_type in ("audit", "validation", "filesystem_scaffold") else 50
    if len(s.strip()) < min_size:
        return PostResult(False, s, f"sanitized_output_too_small: {len(s.strip())} chars < {min_size}")

    return PostResult(True, s, "")


def _best_fence(s: str, preferred_lang: str) -> Optional[str]:
    """Extract the best fenced code block from LLM output.

    Preference order:
      1. Block whose language tag matches the target file language
      2. Largest block by character count
    """
    matches = _FENCE_RE.findall(s)  # [(lang_tag, content), ...]
    if not matches:
        return None

    # Score: language match = +1000, otherwise score by length
    def _score(m):
        tag, content = m
        lang_match = 1000 if (preferred_lang and tag.lower() in preferred_lang) else 0
        return lang_match + len(content)

    best = max(matches, key=_score)
    block = best[1].strip("\n")
    return block if block else None
