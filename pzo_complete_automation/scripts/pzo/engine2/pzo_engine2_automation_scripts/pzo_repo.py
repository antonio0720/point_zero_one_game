#!/usr/bin/env python3
"""pzo_repo.py — repo root detection and safe path joining.

The runner writes code outputs ONLY into the repo root.
It never writes into taskbook folders.

Detection order:
  1) CLI --repo-root (preferred)
  2) env PZO_REPO_ROOT
  3) walk up from cwd looking for pzo-web/ marker
  4) walk up from script dir

Version: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional


_REPO_MARKER = "pzo-web"


def _walk_up(start: Path, marker: str) -> Optional[Path]:
    p = start.resolve()
    for _ in range(12):
        if (p / marker).exists():
            return p
        if p.parent == p:
            break
        p = p.parent
    return None


def resolve_repo_root(*candidates: str) -> Path:
    """Resolve repo root from candidate strings (first valid wins).

    A valid repo root contains pzo-web/.
    """
    for c in candidates:
        if not c:
            continue
        p = Path(c).expanduser().resolve()
        if p.exists() and (p / _REPO_MARKER).exists():
            return p

    # Auto-detect by walking up from cwd then script dir
    for start in (Path.cwd(), Path(__file__).resolve().parent):
        found = _walk_up(start, _REPO_MARKER)
        if found:
            return found

    raise RuntimeError(
        f"Cannot find repo root (looking for directory containing '{_REPO_MARKER}'). "
        f"Set PZO_REPO_ROOT or pass --repo-root."
    )


def repo_path(repo_root: Path, relative: str) -> Path:
    """Join a relative path to repo_root safely.

    The relative path may be absolute (from v4 taskbook) — if it falls under
    repo_root, strip the prefix. If it doesn't, raise ValueError.
    """
    rel = Path(relative)
    if rel.is_absolute():
        # v4 paths are absolute — verify they're within repo_root
        try:
            rel.relative_to(repo_root)
            return rel
        except ValueError:
            # Try to extract relative portion by stripping common suffix
            for part in rel.parts:
                if part == _REPO_MARKER:
                    idx = rel.parts.index(part)
                    rel = Path(*rel.parts[idx:])
                    break
    return (repo_root / rel).resolve()
