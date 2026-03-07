#!/usr/bin/env python3
"""
PZO Engine Extraction Orchestrator v2
======================================
Enhanced from Antonio's v1 with 5 critical fixes:

1. COPY ENTIRE game/ RECURSIVELY — v1 cherry-picked 4 files, but 43 files
   across 8 subdirectories are needed (types/, runtime/, cards/, sovereignty/,
   core/ full, modes/shared/ full). Now copies the whole tree.

2. COPY store/selectors/ — v1 missed this subdirectory.

3. HANDLE import.meta.env — Vite-specific. Replaced with process.env for
   Next.js compatibility. Falls back gracefully if value is undefined.

4. RECURSIVE DEPENDENCY DISCOVERY — After copying, scans ALL files and reports
   every unresolved relative import so you know exactly what's missing.
   No more "copy and pray."

5. GRACEFUL MISSING FILES — Some imports (empire/bleedMode, etc.) reference
   files that don't exist yet. Script warns but doesn't crash. Verification
   report shows exactly which files need to be created.

Usage:
  # Dry run (preview only):
  python3 pzo_extract_engine.py --root /path/to/point_zero_one_master

  # Apply:
  python3 pzo_extract_engine.py --root /path/to/point_zero_one_master --apply

  # Apply + JSON report:
  python3 pzo_extract_engine.py --root /path/to/point_zero_one_master --apply --report-json extraction_report.json

Density6 LLC · Point Zero One · Confidential
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

# ═════════════════════════════════════════════════════════════════════════════
# STATIC CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════════

ENGINE_DIRS: Tuple[str, ...] = (
    "zero", "core", "modes", "battle", "cascade", "cards",
    "pressure", "shield", "sovereignty", "tension", "time", "mechanics",
)

# FIX #1: Instead of cherry-picking files, copy entire subdirectories.
# game/ has 43 files across types/, runtime/, cards/, core/, modes/, sovereignty/.
# All are needed by engines, screens, and store.
GAME_COPY_STRATEGY = "recursive"  # Copy entire pzo-web/src/game/ tree

STORE_FILES: Tuple[str, ...] = (
    "engineStore.ts",
    "engineStore.card-slice.ts",
    "engineStore.mechanics-slice.ts",
    "engineStore.patch.ts",
    "mechanicsRuntimeStore.ts",
    "runStore.ts",
)

# FIX #2: Include store/selectors/
STORE_SUBDIRS: Tuple[str, ...] = (
    "selectors",
)

HOOK_FILES: Tuple[str, ...] = (
    "useGameLoop.ts",
    "useCardEngine.ts",
    "useGameMode.ts",
    "useRunLifecycle.ts",
    "useRunState.ts",
    "useMechanicTelemetry.ts",
)

DATA_FILES: Tuple[str, ...] = (
    "mechanicsLoader.ts",
    "mlLoader.ts",
    "index.ts",
)

SCREEN_FILES: Tuple[str, ...] = (
    "EmpireGameScreen.tsx",
    "PredatorGameScreen.tsx",
    "SyndicateGameScreen.tsx",
    "PhantomGameScreen.tsx",
)

COMPONENT_FILES: Tuple[str, ...] = (
    "GameBoard.tsx",
    "BattleHUD.tsx",
    "CounterplayModal.tsx",
    "EmpireBleedBanner.tsx",
    "EmpirePhaseBadge.tsx",
    "MomentFlash.tsx",
    "RescueWindowBanner.tsx",
    "SabotageImpactPanel.tsx",
    "ShieldIcons.tsx",
    "AidContractComposer.tsx",
    "BalanceSheetPanel.tsx",
    "CapabilitiesPanel.tsx",
    "DistressRecovery.tsx",
    "ResultScreen.tsx",
    "ProofCard.tsx",
    "ProofCardV2.tsx",
    "ThreatRadarPanel.tsx",
    "ReplayTimeline.tsx",
)

SCREEN_COMPONENT_REWRITES: Dict[str, str] = {
    "./GameBoard": "../components/GameBoard",
    "./BattleHUD": "../components/BattleHUD",
    "./CounterplayModal": "../components/CounterplayModal",
    "./EmpireBleedBanner": "../components/EmpireBleedBanner",
    "./EmpirePhaseBadge": "../components/EmpirePhaseBadge",
    "./MomentFlash": "../components/MomentFlash",
    "./RescueWindowBanner": "../components/RescueWindowBanner",
    "./SabotageImpactPanel": "../components/SabotageImpactPanel",
    "./ShieldIcons": "../components/ShieldIcons",
    "./AidContractComposer": "../components/AidContractComposer",
    "./BalanceSheetPanel": "../components/BalanceSheetPanel",
    "./CapabilitiesPanel": "../components/CapabilitiesPanel",
    "./DistressRecovery": "../components/DistressRecovery",
    "./ResultScreen": "../components/ResultScreen",
    "./ProofCard": "../components/ProofCard",
    "./ProofCardV2": "../components/ProofCardV2",
    "./ThreatRadarPanel": "../components/ThreatRadarPanel",
    "./ReplayTimeline": "../components/ReplayTimeline",
}

ENGINE_OUTSIDE_REWRITES: Dict[str, str] = {
    "../../store/": "../store/",
    "../../hooks/": "../hooks/",
    "../../data/": "../data/",
    "../../game/": "../game/",
    "../../exec-compiled/": "../exec-compiled/",
}

PACKAGE_INTERNAL_REWRITES: Dict[str, str] = {
    "../engines/": "../",
}

# game/ files import engines at ../../engines/ and ../../../engines/ depth
GAME_ENGINE_REWRITES: Dict[str, str] = {
    "../../engines/": "../../",
    "../../../engines/": "../../../",
}

# FIX #3: import.meta.env → process.env mapping
IMPORT_META_REWRITES: List[Tuple[re.Pattern, str]] = [
    (re.compile(r'import\.meta\.env\.VITE_API_URL'), "process.env.NEXT_PUBLIC_API_URL"),
    (re.compile(r'import\.meta\.env\.VITE_WS_URL'), "process.env.NEXT_PUBLIC_WS_URL"),
    (re.compile(r'import\.meta\.env\.VITE_(\w+)'), r"process.env.NEXT_PUBLIC_\1"),
    (re.compile(r'import\.meta\.env'), "process.env"),
]

ROOT_GITIGNORE_LINES: Tuple[str, ...] = (
    "frontend/packages/engine/dist/",
    "frontend/packages/engine/node_modules/",
)

PACKAGE_JSON_TEMPLATE = {
    "name": "@pzo/engine",
    "version": "1.0.0",
    "private": True,
    "main": "src/index.ts",
    "types": "src/index.ts",
    "scripts": {
        "typecheck": "tsc --noEmit",
    },
    "peerDependencies": {
        "react": "^18.0.0",
        "zustand": "^4.0.0",
    },
}

INDEX_TS_TEMPLATE = """\
/**
 * @pzo/engine — Barrel Export
 * Point Zero One Engine Package
 */

// ── Orchestrator (singleton) ──────────────────────────────────────────────
export { orchestrator } from './zero/EngineOrchestrator';
export { sharedEventBus } from './zero/EventBus';

// ── Mode Router ───────────────────────────────────────────────────────────
export { ModeRouter } from './modes/ModeRouter';
export type { RunContext, RunConfig } from './modes/ModeRouter';

// ── Types ─────────────────────────────────────────────────────────────────
export type { RunMode, IGameModeEngine } from './core/types';
export type {
  RunLifecycleState, RunOutcome, TickTier, PressureTier, BotId,
} from './zero/types';

// ── Store ─────────────────────────────────────────────────────────────────
export { useEngineStore } from './store/engineStore';
export { useRunStore } from './store/runStore';

// ── Hooks ─────────────────────────────────────────────────────────────────
export { useGameLoop } from './hooks/useGameLoop';

// ── Game Screens ──────────────────────────────────────────────────────────
export { default as EmpireGameScreen } from './screens/EmpireGameScreen';
export { default as PredatorGameScreen } from './screens/PredatorGameScreen';
export { default as SyndicateGameScreen } from './screens/SyndicateGameScreen';
export { default as PhantomGameScreen } from './screens/PhantomGameScreen';

// ── Format Utils ──────────────────────────────────────────────────────────
export {
  fmtMoney, fmtHash, fmtRunId, fmtGrade, fmtBotName,
  fmtChainId, fmtTickTier, fmtSovereigntyScore,
  TICK_TIER_LABELS,
} from './game/core/format';
"""

GAME_SHELL_TEMPLATE = """\
'use client';

import { useEffect, useRef } from 'react';
import {
  orchestrator,
  EmpireGameScreen,
  PredatorGameScreen,
  SyndicateGameScreen,
  PhantomGameScreen,
} from '@pzo/engine';
import type { RunMode } from '@pzo/engine';

interface RunContext {
  runId: string;
  mode: RunMode | string;
  config: Record<string, any>;
  startedAt: number;
  seed: number;
}

interface GameShellProps {
  runContext: RunContext;
  onRunEnd: (outcome: string) => void;
  onBackToLobby: () => void;
}

export default function GameShell({ runContext, onRunEnd, onBackToLobby }: GameShellProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    void orchestrator.startRun({
      runId:            runContext.runId,
      userId:           (runContext.config as any)?.userId ?? 'player_01',
      seed:             String(runContext.seed),
      seasonTickBudget: (runContext.config as any)?.seasonTickBudget ?? 720,
      freedomThreshold: (runContext.config as any)?.freedomThreshold ?? 500_000,
      clientVersion:    '4.0.0',
      engineVersion:    '4.0.0',
    } as any);

    return () => {
      try { orchestrator.endRun('ABANDONED' as any); }
      catch (e) { console.error('[GameShell] endRun error:', e); }
    };
  }, [runContext]);

  switch (runContext.mode) {
    case 'solo':           return <EmpireGameScreen />;
    case 'asymmetric-pvp': return <PredatorGameScreen />;
    case 'co-op':          return <SyndicateGameScreen />;
    case 'ghost':          return <PhantomGameScreen />;
    default:               return <EmpireGameScreen />;
  }
}
"""


# ═════════════════════════════════════════════════════════════════════════════
# RUNNER
# ═════════════════════════════════════════════════════════════════════════════

@dataclass
class Stats:
    created: int = 0
    updated: int = 0
    copied: int = 0
    deleted: int = 0
    backups: int = 0
    unchanged: int = 0
    import_meta_rewrites: int = 0
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    verification: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {k: v for k, v in self.__dict__.items()}


class EngineExtractionError(RuntimeError):
    pass


class Runner:
    def __init__(self, root: Path, dry_run: bool, verbose: bool = True) -> None:
        self.root = root.resolve()
        self.dry_run = dry_run
        self.verbose = verbose
        self.stats = Stats()
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    def log(self, msg: str) -> None:
        if self.verbose:
            print(msg)

    def warn(self, msg: str) -> None:
        self.stats.warnings.append(msg)
        self.log(f"  ⚠ {msg}")

    def error(self, msg: str) -> None:
        self.stats.errors.append(msg)
        self.log(f"  ❌ {msg}")

    def ensure_parent(self, path: Path) -> None:
        if not self.dry_run:
            path.parent.mkdir(parents=True, exist_ok=True)

    def backup(self, path: Path) -> Optional[Path]:
        if not path.exists():
            return None
        bak = path.with_name(f"{path.name}.bak.{self.timestamp}")
        if not self.dry_run:
            shutil.copy2(path, bak)
        self.stats.backups += 1
        return bak

    def write_text(self, path: Path, content: str, *, backup: bool = False) -> None:
        existing = path.read_text(encoding="utf-8") if path.exists() else None
        if existing == content:
            self.stats.unchanged += 1
            return
        if path.exists() and backup:
            self.backup(path)
        self.ensure_parent(path)
        if not self.dry_run:
            path.write_text(content, encoding="utf-8")
        self.stats.created += 1 if existing is None else 0
        self.stats.updated += 1 if existing is not None else 0
        self.log(f"  {'CREATE' if existing is None else 'UPDATE'}: {path.relative_to(self.root)}")

    def write_json(self, path: Path, data: object, **kw) -> None:
        self.write_text(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n", **kw)

    def copy_file(self, src: Path, dst: Path, *, required: bool = True) -> None:
        if not src.exists():
            if required:
                raise EngineExtractionError(f"missing source: {src}")
            self.warn(f"source not found (skipped): {src.relative_to(self.root)}")
            return
        self.ensure_parent(dst)
        if not self.dry_run:
            shutil.copy2(src, dst)
        self.stats.copied += 1

    def copy_tree(self, src: Path, dst: Path) -> None:
        if not src.exists() or not src.is_dir():
            raise EngineExtractionError(f"missing source directory: {src}")
        if dst.exists() and not self.dry_run:
            shutil.rmtree(dst)
        if not self.dry_run:
            shutil.copytree(src, dst)
        count = sum(1 for _ in dst.rglob("*") if _.is_file()) if not self.dry_run else 0
        self.stats.copied += 1
        self.log(f"  COPYTREE: {src.relative_to(self.root)} → {dst.relative_to(self.root)} ({count} files)")

    def remove_path(self, path: Path) -> None:
        if not path.exists():
            return
        if not self.dry_run:
            shutil.rmtree(path) if path.is_dir() else path.unlink()
        self.stats.deleted += 1


# ═════════════════════════════════════════════════════════════════════════════
# IMPORT REWRITING
# ═════════════════════════════════════════════════════════════════════════════

def iter_code_files(root: Path) -> Iterable[Path]:
    for ext in (".ts", ".tsx"):
        yield from root.rglob(f"*{ext}")


def iter_clean_code_files(root: Path) -> Iterable[Path]:
    for path in iter_code_files(root):
        if ".bak" in path.name or path.name == ".DS_Store":
            continue
        yield path


def apply_literal_rewrites(path: Path, rewrites: Dict[str, str], dry_run: bool) -> int:
    """Rewrite string literals containing target patterns."""
    if not path.exists():
        return 0
    original = path.read_text(encoding="utf-8")
    updated = original
    total = 0
    for before, after in rewrites.items():
        pattern = re.compile(
            rf"(?P<quote>['\"])({re.escape(before)})(?P<tail>[^'\"]*)(?P=quote)"
        )
        def _repl(m, _after=after):
            nonlocal total
            total += 1
            return f"{m.group('quote')}{_after}{m.group('tail')}{m.group('quote')}"
        updated = pattern.sub(_repl, updated)
    if updated != original and not dry_run:
        path.write_text(updated, encoding="utf-8")
    return total


def rewrite_import_meta_env(path: Path, dry_run: bool) -> int:
    """FIX #3: Replace import.meta.env.VITE_X with process.env.NEXT_PUBLIC_X."""
    if not path.exists():
        return 0
    original = path.read_text(encoding="utf-8")
    updated = original
    total = 0
    for pattern, repl in IMPORT_META_REWRITES:
        updated, count = pattern.subn(repl, updated)
        total += count
    if updated != original and not dry_run:
        path.write_text(updated, encoding="utf-8")
    return total


def rewrite_all_imports(package_src: Path, runner: Runner) -> Dict[str, int]:
    """Apply all import rewrites across the entire package."""
    counts = {"engine_outside": 0, "package_internal": 0, "screen_component": 0, "game_engine": 0, "import_meta": 0}

    for path in iter_clean_code_files(package_src):
        rel = path.relative_to(package_src)
        parts = rel.parts

        # Engine files: ../../store → ../store, etc.
        if parts and parts[0] in ENGINE_DIRS:
            counts["engine_outside"] += apply_literal_rewrites(
                path, ENGINE_OUTSIDE_REWRITES, runner.dry_run
            )

        # Store/hooks/components/screens: ../engines/ → ../
        if parts and parts[0] in {"store", "hooks", "components", "screens"}:
            counts["package_internal"] += apply_literal_rewrites(
                path, PACKAGE_INTERNAL_REWRITES, runner.dry_run
            )

        # Screens: ./GameBoard → ../components/GameBoard
        if parts and parts[0] == "screens":
            counts["screen_component"] += apply_literal_rewrites(
                path, SCREEN_COMPONENT_REWRITES, runner.dry_run
            )

        # Game files: ../../engines/X → ../../X (remove engines/ from path)
        if parts and parts[0] == "game":
            counts["game_engine"] = counts.get("game_engine", 0) + apply_literal_rewrites(
                path, GAME_ENGINE_REWRITES, runner.dry_run
            )

        # FIX #3: import.meta.env → process.env
        counts["import_meta"] += rewrite_import_meta_env(path, runner.dry_run)

    runner.stats.import_meta_rewrites = counts["import_meta"]
    runner.log(f"\n  Import rewrites: {counts}")
    return counts


# ═════════════════════════════════════════════════════════════════════════════
# VERIFICATION (FIX #4: Recursive dependency discovery)
# ═════════════════════════════════════════════════════════════════════════════

IMPORT_RE = re.compile(
    r"""(?:import\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?|export\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?|import\()
    (?P<quote>['"])(?P<path>\.[^'"]+)(?P=quote)""",
    re.VERBOSE,
)

RESOLVE_EXTS = (".ts", ".tsx", ".js", ".jsx", ".json")


def resolve_import(base_file: Path, import_path: str) -> Optional[Path]:
    target = (base_file.parent / import_path).resolve()
    # Direct match
    if target.exists() and target.is_file():
        return target
    # Try extensions
    for ext in RESOLVE_EXTS:
        candidate = target.with_suffix(ext)
        if candidate.exists():
            return candidate
    # Try index files
    if target.is_dir():
        for ext in RESOLVE_EXTS:
            candidate = target / f"index{ext}"
            if candidate.exists():
                return candidate
    # Try without existing suffix + new extensions
    if not target.suffix:
        for ext in RESOLVE_EXTS:
            candidate = target.parent / (target.name + ext)
            if candidate.exists():
                return candidate
    return None


def verify_package(package_src: Path) -> Dict[str, object]:
    """FIX #4: Full recursive dependency scan."""
    issues = {
        "bad_dotdot_outside": [],       # ../../store etc still present
        "bad_dotdot_engines": [],        # ../engines/ still present
        "unresolved_imports": [],        # import points to nonexistent file
        "import_meta_remaining": [],     # import.meta still present
        "deprecated_orchestrator": [],   # DEPRECATED file still present
    }
    file_count = 0

    for path in iter_clean_code_files(package_src):
        text = path.read_text(encoding="utf-8")
        file_count += 1
        rel = str(path.relative_to(package_src))
        parts = Path(rel).parts
        # (game/ files legitimately use ../../data/ etc.)
        if parts and parts[0] in ENGINE_DIRS:
            for bad in ("../../store/", "../../hooks/", "../../data/", "../../game/", "../../exec-compiled/"):
                if bad in text and f"from '{bad}" in text:
                    issues["bad_dotdot_outside"].append(f"{rel} :: {bad}")

        if rel.startswith(("store/", "hooks/", "components/", "screens/")) and "from '../engines/" in text:
            issues["bad_dotdot_engines"].append(rel)

        if "import.meta" in text:
            issues["import_meta_remaining"].append(rel)

        if "EngineOrchestrator.DEPRECATED" in path.name:
            issues["deprecated_orchestrator"].append(rel)

        # FIX #4: Resolve every relative import
        for match in IMPORT_RE.finditer(text):
            raw = match.group("path")
            if not raw.startswith("."):
                continue
            resolved = resolve_import(path, raw)
            if resolved is None:
                issues["unresolved_imports"].append(f"{rel} → {raw}")

    all_clean = not any(v for v in issues.values())

    return {
        "scanned_files": file_count,
        "all_clean": all_clean,
        **{k: sorted(set(v)) for k, v in issues.items()},
    }


# ═════════════════════════════════════════════════════════════════════════════
# NEXT.JS INTEGRATION
# ═════════════════════════════════════════════════════════════════════════════

def patch_web_package_json(pkg_path: Path, runner: Runner) -> None:
    if not pkg_path.exists():
        runner.warn(f"Next.js package.json not found: {pkg_path}")
        return
    data = json.loads(pkg_path.read_text(encoding="utf-8"))
    deps = data.setdefault("dependencies", {})
    if deps.get("@pzo/engine") == "file:../../packages/engine":
        runner.stats.unchanged += 1
        return
    runner.backup(pkg_path)
    deps["@pzo/engine"] = "file:../../packages/engine"
    data["dependencies"] = dict(sorted(deps.items()))
    runner.write_json(pkg_path, data)


def patch_next_config(web_dir: Path, runner: Runner) -> None:
    candidates = ["next.config.js", "next.config.mjs", "next.config.ts"]
    existing = next((web_dir / c for c in candidates if (web_dir / c).exists()), None)

    if existing and "@pzo/engine" in existing.read_text(encoding="utf-8"):
        runner.stats.unchanged += 1
        return

    if existing is None:
        content = "/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  transpilePackages: ['@pzo/engine'],\n};\n\nmodule.exports = nextConfig;\n"
        runner.write_text(web_dir / "next.config.js", content)
        return

    runner.backup(existing)
    text = existing.read_text(encoding="utf-8")
    # Inject transpilePackages into existing config object
    for pattern in [r"module\.exports\s*=\s*{", r"const\s+nextConfig\s*=\s*{", r"export\s+default\s*{"]:
        if re.search(pattern, text):
            text = re.sub(pattern, lambda m: f"{m.group(0)}\n  transpilePackages: ['@pzo/engine'],", text, count=1)
            break
    runner.write_text(existing, text)


def patch_game_shell(path: Path, runner: Runner) -> None:
    runner.write_text(path, GAME_SHELL_TEMPLATE, backup=True)


def patch_play_page(path: Path, runner: Runner) -> None:
    if not path.exists():
        runner.warn(f"play/page.tsx not found: {path}")
        return
    original = path.read_text(encoding="utf-8")
    updated = original

    # Replace Strategy B comment
    updated = updated.replace(
        "// Strategy B: direct redirect to Vite engine (no intermediate SSR hop)",
        "// Strategy A: game runs inside Next.js via @pzo/engine",
    )

    # Replace window.location.href redirect with router.push
    # Match the multi-line redirect block
    redirect_re = re.compile(
        r"const GAME_URL = process\.env\.NEXT_PUBLIC_GAME_URL[^;]+;\s*"
        r"window\.location\.href\s*=\s*`[^`]+`;",
        re.DOTALL,
    )
    updated = redirect_re.sub(
        "router.push(`/game?runId=${ctx.runId}`);",
        updated,
    )

    # Fallback: just replace window.location.href line
    if "window.location.href" in updated:
        updated = re.sub(
            r"window\.location\.href\s*=\s*`[^`]+`;",
            "router.push(`/game?runId=${ctx.runId}`);",
            updated,
            count=1,
        )

    if updated == original:
        runner.warn("play/page.tsx: no redirect replacement found")
        return

    runner.backup(path)
    runner.write_text(path, updated)


def ensure_gitignore(root: Path, runner: Runner) -> None:
    gi = root / ".gitignore"
    text = gi.read_text(encoding="utf-8") if gi.exists() else ""
    lines = text.splitlines()
    added = False
    for line in ROOT_GITIGNORE_LINES:
        if line not in lines:
            text = text.rstrip() + f"\n{line}\n"
            added = True
    if added:
        runner.write_text(gi, text, backup=gi.exists())


# ═════════════════════════════════════════════════════════════════════════════
# MAIN ORCHESTRATION
# ═════════════════════════════════════════════════════════════════════════════

def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Extract PZO engine into frontend/packages/engine")
    p.add_argument("--root", default=".", help="Repository root")
    p.add_argument("--apply", action="store_true", help="Actually write files (omit for dry-run)")
    p.add_argument("--report-json", default="", help="Write JSON report to this path")
    p.add_argument("--strict", action="store_true", help="Exit non-zero on warnings")
    p.add_argument("--no-next", action="store_true", help="Skip Next.js integration patches")
    p.add_argument("--verify-only", action="store_true", help="Only verify existing package, don't copy/patch")
    return p.parse_args(argv)


def execute(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    runner = Runner(root=root, dry_run=not args.apply)

    pzo_src = root / "pzo-web" / "src"
    web_dir = root / "frontend" / "apps" / "web"
    pkg_dir = root / "frontend" / "packages" / "engine"
    pkg_src = pkg_dir / "src"

    # Preflight
    if not pzo_src.exists():
        raise EngineExtractionError(f"pzo-web/src not found at {pzo_src}")

    mode = "VERIFY-ONLY" if args.verify_only else ("APPLY" if args.apply else "DRY-RUN")
    runner.log(f"\n{'═' * 60}")
    runner.log(f"  PZO ENGINE EXTRACTION — {mode}")
    runner.log(f"  Root: {root}")
    runner.log(f"{'═' * 60}\n")

    # ── VERIFY-ONLY mode ─────────────────────────────────────────────────
    if args.verify_only:
        if not pkg_src.exists():
            raise EngineExtractionError(f"Package src not found: {pkg_src}")
        v = verify_package(pkg_src)
        runner.stats.verification = v
        print(json.dumps(v, indent=2))
        return 0 if v["all_clean"] else 3

    # ── PHASE 1: Package scaffold ────────────────────────────────────────
    runner.log("Phase 1: Creating package scaffold...")
    runner.write_json(pkg_dir / "package.json", PACKAGE_JSON_TEMPLATE)
    runner.write_text(pkg_src / "index.ts", INDEX_TS_TEMPLATE)

    # ── PHASE 2: Copy engine directories ─────────────────────────────────
    runner.log("\nPhase 2: Copying engine directories...")
    for dirname in ENGINE_DIRS:
        src_dir = pzo_src / "engines" / dirname
        dst_dir = pkg_src / dirname
        if src_dir.exists():
            runner.copy_tree(src_dir, dst_dir)
        else:
            runner.warn(f"engine dir not found: {dirname}")

    # ── PHASE 3: Copy supporting files ───────────────────────────────────
    runner.log("\nPhase 3: Copying supporting files...")

    # Store files
    for f in STORE_FILES:
        runner.copy_file(pzo_src / "store" / f, pkg_src / "store" / f, required=False)

    # FIX #2: Store subdirectories
    for subdir in STORE_SUBDIRS:
        src_sub = pzo_src / "store" / subdir
        if src_sub.exists() and src_sub.is_dir():
            runner.copy_tree(src_sub, pkg_src / "store" / subdir)

    # Hook files
    for f in HOOK_FILES:
        runner.copy_file(pzo_src / "hooks" / f, pkg_src / "hooks" / f, required=False)

    # Data files + JSONs
    for f in DATA_FILES:
        runner.copy_file(pzo_src / "data" / f, pkg_src / "data" / f, required=False)
    for json_file in sorted((pzo_src / "data").glob("*.json")):
        runner.copy_file(json_file, pkg_src / "data" / json_file.name, required=False)

    # FIX #1: Copy ENTIRE game/ directory recursively
    game_src = pzo_src / "game"
    if game_src.exists():
        runner.log("  Copying entire game/ tree (FIX #1)...")
        runner.copy_tree(game_src, pkg_src / "game")
    else:
        runner.warn("game/ directory not found")

    # Copy pzo-web/src/types/ (components import ../types/game, ../types/club)
    types_src = pzo_src / "types"
    if types_src.exists():
        runner.log("  Copying types/ directory...")
        runner.copy_tree(types_src, pkg_src / "types")
    else:
        runner.warn("types/ directory not found")

    # ── PHASE 4: Copy screens + components ───────────────────────────────
    runner.log("\nPhase 4: Copying screens and components...")
    comps_src = pzo_src / "components"

    for f in SCREEN_FILES:
        runner.copy_file(comps_src / f, pkg_src / "screens" / f, required=False)

    for f in COMPONENT_FILES:
        runner.copy_file(comps_src / f, pkg_src / "components" / f, required=False)

    # ── PHASE 5: Clean artifacts ─────────────────────────────────────────
    runner.log("\nPhase 5: Cleaning copied artifacts...")
    if not runner.dry_run:
        for path in pkg_src.rglob("*"):
            if path.is_file() and (".bak" in path.name or path.name == ".DS_Store"):
                runner.remove_path(path)
        # Sideline deprecated orchestrator
        deprecated = pkg_src / "core" / "EngineOrchestrator.DEPRECATED.ts"
        if deprecated.exists():
            runner.remove_path(deprecated)
            runner.log("  Removed EngineOrchestrator.DEPRECATED.ts from package")

    # ── PHASE 6: Rewrite imports ─────────────────────────────────────────
    runner.log("\nPhase 6: Rewriting imports...")
    if not runner.dry_run:
        counts = rewrite_all_imports(pkg_src, runner)
    else:
        counts = {"engine_outside": "?", "package_internal": "?", "screen_component": "?", "import_meta": "?"}
        runner.log("  (skipped in dry-run)")

    # ── PHASE 7: Generate tsconfig ───────────────────────────────────────
    runner.log("\nPhase 7: Generating tsconfig.json...")
    # Detect if import.meta is still used (needs vite/client types)
    has_import_meta = False
    if not runner.dry_run:
        for path in iter_clean_code_files(pkg_src):
            if "import.meta" in path.read_text(encoding="utf-8"):
                has_import_meta = True
                break
    tsconfig = {
        "compilerOptions": {
            "target": "ES2020",
            "module": "ESNext",
            "moduleResolution": "bundler",
            "jsx": "react-jsx",
            "strict": True,
            "esModuleInterop": True,
            "skipLibCheck": True,
            "forceConsistentCasingInFileNames": True,
            "resolveJsonModule": True,
            "declaration": True,
            "declarationMap": True,
            "outDir": "dist",
            "rootDir": "src",
            "baseUrl": ".",
            "paths": {"@pzo/engine/*": ["src/*"]},
            **({"types": ["vite/client"]} if has_import_meta else {}),
        },
        "include": ["src/**/*"],
        "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.bak*"],
    }
    runner.write_json(pkg_dir / "tsconfig.json", tsconfig)

    # ── PHASE 8: Next.js integration ─────────────────────────────────────
    if not args.no_next:
        runner.log("\nPhase 8: Patching Next.js integration...")
        patch_web_package_json(web_dir / "package.json", runner)
        patch_next_config(web_dir, runner)
        patch_game_shell(web_dir / "app" / "(app)" / "game" / "GameShell.tsx", runner)
        patch_play_page(web_dir / "app" / "(app)" / "play" / "page.tsx", runner)
    else:
        runner.log("\nPhase 8: Skipped (--no-next)")

    # ── PHASE 9: .gitignore ──────────────────────────────────────────────
    runner.log("\nPhase 9: Updating .gitignore...")
    ensure_gitignore(root, runner)

    # ── PHASE 10: Verification ───────────────────────────────────────────
    runner.log("\nPhase 10: Verification...")
    if not runner.dry_run:
        verification = verify_package(pkg_src)
        verification["rewrite_counts"] = counts
        runner.stats.verification = verification

        if verification["all_clean"]:
            runner.log("\n  ✅ ALL CLEAN — Zero broken imports detected")
        else:
            runner.log("\n  ⚠ ISSUES FOUND:")
            for key, items in verification.items():
                if isinstance(items, list) and items:
                    runner.log(f"\n  {key} ({len(items)}):")
                    for item in items[:15]:
                        runner.log(f"    • {item}")
                    if len(items) > 15:
                        runner.log(f"    ... and {len(items) - 15} more")
    else:
        runner.log("  (skipped in dry-run)")

    # ── Report ───────────────────────────────────────────────────────────
    if args.report_json:
        report_path = Path(args.report_json)
        if not report_path.is_absolute():
            report_path = root / report_path
        runner.write_json(report_path, runner.stats.to_dict())

    print(f"\n{'═' * 60}")
    print(f"  SUMMARY")
    print(f"{'═' * 60}")
    print(f"  Created:  {runner.stats.created}")
    print(f"  Updated:  {runner.stats.updated}")
    print(f"  Copied:   {runner.stats.copied}")
    print(f"  Deleted:  {runner.stats.deleted}")
    print(f"  Backups:  {runner.stats.backups}")
    print(f"  Warnings: {len(runner.stats.warnings)}")
    print(f"  Errors:   {len(runner.stats.errors)}")
    if runner.stats.import_meta_rewrites:
        print(f"  import.meta → process.env: {runner.stats.import_meta_rewrites}")
    v = runner.stats.verification
    if v:
        print(f"  Verification: {'✅ CLEAN' if v.get('all_clean') else '⚠ ISSUES'}")
        print(f"  Scanned files: {v.get('scanned_files', '?')}")
        unresolved = v.get("unresolved_imports", [])
        if unresolved:
            print(f"  Unresolved imports: {len(unresolved)}")
    print(f"{'═' * 60}\n")

    if runner.stats.errors:
        return 1
    if args.strict and runner.stats.warnings:
        return 2
    if v and not v.get("all_clean", True):
        return 3
    return 0


def main(argv: Sequence[str]) -> int:
    try:
        args = parse_args(argv)
        return execute(args)
    except EngineExtractionError as exc:
        print(f"\n  ❌ FATAL: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\n  ❌ Interrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
