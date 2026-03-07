#!/usr/bin/env python3
"""
PZO Strategy A Fixer
Kill the Vite redirect path. Normalize the engine package for Next.js Strategy A.

What this script does
---------------------
1. Adds EngineId + init() to the 7 registry-managed engines that currently do not
   satisfy the IEngine contract.
2. Rewrites hooks/useGameLoop.ts so it imports the correct orchestrator symbol and
   reads the actual engine store fields that exist in the extracted engine package.
3. Extends runStore with a typed runPhase + setRunPhase() action.
4. Wires runStore lifecycle updates inside engineStore.wireAllEngineHandlers().
5. Creates bootstrap.ts and exports bootstrapEngine from the barrel.
6. Replaces the Next.js GameShell redirect shim with an in-process Strategy A shell.
7. Verifies the patch set and writes a machine-readable report.

Design goals
------------
- Deterministic file I/O + regex/string transforms only.
- Idempotent: safe to re-run.
- Backup-aware: copies original files before mutation.
- Dry-run by default.
- Fails loudly if the repo shape does not match expectations.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence


# =============================================================================
# Constants
# =============================================================================

ENGINE_SPECS = [
    {
        "rel": "frontend/packages/engine/src/time/TimeEngine.ts",
        "class_name": "TimeEngine",
        "engine_id": "TIME",
        "import_line": "import { EngineId, type EngineInitParams } from '../zero/types';\n",
        "init_method": (
            "  public init(params: EngineInitParams): void {\n"
            "    this.setSeasonBudget(params.seasonTickBudget);\n"
            "    this.reset();\n"
            "  }\n\n"
        ),
    },
    {
        "rel": "frontend/packages/engine/src/pressure/PressureEngine.ts",
        "class_name": "PressureEngine",
        "engine_id": "PRESSURE",
        "import_line": "import { EngineId, type EngineInitParams } from '../zero/types';\n",
        "init_method": (
            "  public readonly engineId: EngineId = EngineId.PRESSURE;\n"  # placeholder stripped later
        ),
    },
    {
        "rel": "frontend/packages/engine/src/tension/TensionEngine.ts",
        "class_name": "TensionEngine",
        "engine_id": "TENSION",
        "import_line": "import { EngineId, type EngineInitParams } from '../zero/types';\n",
        "init_method": (
            "  public readonly engineId: EngineId = EngineId.TENSION;\n"
        ),
    },
    {
        "rel": "frontend/packages/engine/src/shield/ShieldEngine.ts",
        "class_name": "ShieldEngine",
        "engine_id": "SHIELD",
        "import_line": "import { EngineId, type EngineInitParams } from '../zero/types';\n",
        "init_method": (
            "  public readonly engineId: EngineId = EngineId.SHIELD;\n"
        ),
    },
    {
        "rel": "frontend/packages/engine/src/battle/BattleEngine.ts",
        "class_name": "BattleEngine",
        "engine_id": "BATTLE",
        "import_line": "import { EngineId, type EngineInitParams } from '../zero/types';\n",
        "init_method": (
            "  public readonly engineId: EngineId = EngineId.BATTLE;\n"
        ),
    },
    {
        "rel": "frontend/packages/engine/src/cascade/CascadeEngine.ts",
        "class_name": "CascadeEngine",
        "engine_id": "CASCADE",
        "import_line": "import { EngineId, type EngineInitParams } from '../zero/types';\n",
        "init_method": (
            "  public readonly engineId: EngineId = EngineId.CASCADE;\n"
        ),
    },
    {
        "rel": "frontend/packages/engine/src/sovereignty/SovereigntyEngine.ts",
        "class_name": "SovereigntyEngine",
        "engine_id": "SOVEREIGNTY",
        "import_line": "import { EngineId, type EngineInitParams } from '../zero/types';\n",
        "init_method": (
            "  public readonly engineId: EngineId = EngineId.SOVEREIGNTY;\n"
        ),
    },
]

USE_GAME_LOOP_REL = "frontend/packages/engine/src/hooks/useGameLoop.ts"
RUN_STORE_REL = "frontend/packages/engine/src/store/runStore.ts"
ENGINE_STORE_REL = "frontend/packages/engine/src/store/engineStore.ts"
BOOTSTRAP_REL = "frontend/packages/engine/src/bootstrap.ts"
INDEX_REL = "frontend/packages/engine/src/index.ts"
GAME_SHELL_REL = "frontend/apps/web/app/(app)/game/GameShell.tsx"

REQUIRED_PATHS = [
    USE_GAME_LOOP_REL,
    RUN_STORE_REL,
    ENGINE_STORE_REL,
    INDEX_REL,
    GAME_SHELL_REL,
    *[spec["rel"] for spec in ENGINE_SPECS],
]


# =============================================================================
# Templates
# =============================================================================

USE_GAME_LOOP_TEMPLATE = """/**
 * hooks/useGameLoop.ts — POINT ZERO ONE
 * RAF-driven orchestrator tick loop. Starts/stops with run lifecycle.
 * Uses real Strategy A engine-store fields from the extracted package.
 *
 * FILE LOCATION: frontend/packages/engine/src/hooks/useGameLoop.ts
 * Density6 LLC · Confidential
 */

import { useCallback, useEffect, useRef } from 'react';
import { orchestrator as engineOrchestrator } from '../zero/EngineOrchestrator';
import { useEngineStore } from '../store/engineStore';
import { useRunStore, type RunPhase } from '../store/runStore';

export interface GameLoopState {
  tick: number;
  runPhase: RunPhase;
  isRunning: boolean;
  tickRate: number;
}

const DEFAULT_TICK_RATE_MS = 2_000;
const MIN_TICK_RATE_MS = 50;

export function useGameLoop(): GameLoopState {
  const tick = useEngineStore((s) => s.run.lastTickIndex);
  const tickRate = useEngineStore((s) =>
    s.run.lastTickDurationMs > 0 ? s.run.lastTickDurationMs : DEFAULT_TICK_RATE_MS,
  );
  const runPhase = useRunStore((s) => s.runPhase);

  const rafRef = useRef<number>(0);
  const lastTickTime = useRef<number>(0);
  const tickRateRef = useRef<number>(tickRate);
  const isRunningRef = useRef<boolean>(false);

  tickRateRef.current = Math.max(MIN_TICK_RATE_MS, tickRate || DEFAULT_TICK_RATE_MS);
  isRunningRef.current = runPhase === 'RUNNING';

  const loop = useCallback((timestamp: number) => {
    if (!isRunningRef.current) return;

    const elapsed = timestamp - lastTickTime.current;
    if (elapsed >= tickRateRef.current) {
      lastTickTime.current = timestamp - (elapsed % tickRateRef.current);
      try {
        void engineOrchestrator.executeTick();
      } catch (err) {
        console.error('[useGameLoop] executeTick threw:', err);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (runPhase !== 'RUNNING') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTickTime.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [runPhase, loop]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    tick,
    runPhase,
    isRunning: runPhase === 'RUNNING',
    tickRate: tickRateRef.current,
  };
}
"""

BOOTSTRAP_TEMPLATE = """/**
 * bootstrap.ts — Strategy A one-time wiring for @pzo/engine
 *
 * Re-wires EventBus → Zustand stores after EngineOrchestrator.reset(),
 * and avoids duplicate runStore mirror subscriptions across HMR cycles.
 */

import { sharedEventBus } from './zero/EventBus';
import { useEngineStore, wireAllEngineHandlers, wireRunStoreMirror } from './store/engineStore';

interface BootstrapState {
  initialized: boolean;
  mirrorUnsub: (() => void) | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __PZO_ENGINE_BOOTSTRAP_STATE__: BootstrapState | undefined;
}

function getBootstrapState(): BootstrapState {
  if (!globalThis.__PZO_ENGINE_BOOTSTRAP_STATE__) {
    globalThis.__PZO_ENGINE_BOOTSTRAP_STATE__ = {
      initialized: false,
      mirrorUnsub: null,
    };
  }

  return globalThis.__PZO_ENGINE_BOOTSTRAP_STATE__;
}

export function bootstrapEngine(opts?: { force?: boolean }): void {
  const state = getBootstrapState();
  const force = opts?.force === true;

  if (state.initialized && !force) {
    return;
  }

  if (state.mirrorUnsub) {
    try {
      state.mirrorUnsub();
    } catch {
      // ignore stale unsubscribe closures during HMR / route transitions
    }
    state.mirrorUnsub = null;
  }

  wireAllEngineHandlers(sharedEventBus, useEngineStore.setState as any);
  state.mirrorUnsub = wireRunStoreMirror();
  state.initialized = true;

  if (process.env.NODE_ENV !== 'production') {
    console.info('[PZO] bootstrapEngine complete');
  }
}
"""

GAME_SHELL_TEMPLATE = """'use client';

import { useEffect, useRef, useState } from 'react';
import {
  bootstrapEngine,
  EmpireGameScreen,
  orchestrator,
  PhantomGameScreen,
  PredatorGameScreen,
  SyndicateGameScreen,
  useEngineStore,
  useRunStore,
} from '@pzo/engine';

const DEFAULT_TICK_RATE_MS = 2_000;
const MIN_TICK_RATE_MS = 50;

type RunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

interface GameShellProps {
  runContext: {
    runId: string;
    mode: string;
    config: Record<string, any>;
    startedAt: number;
    seed: number;
  };
  onRunEnd: (outcome: string) => void;
  onBackToLobby: () => void;
}

function useTickLoop(): void {
  const tickRate = useEngineStore((s) =>
    s.run.lastTickDurationMs > 0 ? s.run.lastTickDurationMs : DEFAULT_TICK_RATE_MS,
  );
  const runPhase = useRunStore((s) => s.runPhase);

  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const tickRateRef = useRef<number>(tickRate);
  const runPhaseRef = useRef(runPhase);

  tickRateRef.current = Math.max(MIN_TICK_RATE_MS, tickRate || DEFAULT_TICK_RATE_MS);
  runPhaseRef.current = runPhase;

  useEffect(() => {
    if (runPhase !== 'RUNNING') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTickRef.current = performance.now();

    const loop = (ts: number) => {
      if (runPhaseRef.current !== 'RUNNING') return;

      const elapsed = ts - lastTickRef.current;
      if (elapsed >= tickRateRef.current) {
        lastTickRef.current = ts - (elapsed % tickRateRef.current);
        try {
          void orchestrator.executeTick();
        } catch (e) {
          console.error('[GameShell] executeTick failed:', e);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [runPhase]);
}

function renderMode(mode: RunMode) {
  switch (mode) {
    case 'solo':
      return <EmpireGameScreen />;
    case 'asymmetric-pvp':
      return <PredatorGameScreen />;
    case 'co-op':
      return <SyndicateGameScreen />;
    case 'ghost':
      return <PhantomGameScreen />;
    default:
      return <EmpireGameScreen />;
  }
}

export default function GameShell({ runContext, onRunEnd, onBackToLobby }: GameShellProps) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const initRef = useRef(false);
  const notifiedEndRef = useRef(false);

  const runPhase = useRunStore((s) => s.runPhase);
  const outcome = useEngineStore((s) => s.run.outcome);

  useTickLoop();

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    try {
      useEngineStore.getState().resetAllSlices();
      useRunStore.getState().reset();
      orchestrator.reset();
      bootstrapEngine({ force: true });

      orchestrator.startRun({
        runId: runContext.runId,
        userId: 'player_01',
        seed: String(runContext.seed),
        seasonTickBudget: 720,
        freedomThreshold: 500_000,
        clientVersion: '4.0.0',
        engineVersion: '4.0.0',
      } as any);

      setReady(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[GameShell] startRun failed:', e);
      setBootError(message);
    }

    return () => {
      try {
        useEngineStore.getState().resetAllSlices();
        useRunStore.getState().reset();
        orchestrator.reset();
      } catch {
        // ignore teardown errors during route transitions / HMR
      }
    };
  }, [runContext]);

  useEffect(() => {
    if (runPhase !== 'ENDED' || notifiedEndRef.current) return;
    notifiedEndRef.current = true;
    onRunEnd(outcome ?? 'ABANDONED');
  }, [runPhase, outcome, onRunEnd]);

  if (bootError) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#030308', color: '#F5C842', fontFamily: 'monospace' }}>
        <div style={{ maxWidth: 760, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.3em', marginBottom: 16 }}>ENGINE BOOT FAILED</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#F0F0FF', opacity: 0.9 }}>{bootError}</div>
          <button
            onClick={onBackToLobby}
            style={{ marginTop: 24, padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#F5C842', fontSize: 11, cursor: 'pointer', letterSpacing: '0.15em', textTransform: 'uppercase' }}
          >
            Back To Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#030308', color: '#F5C842', fontFamily: 'monospace' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em' }}>STARTING ENGINE...</div>
      </div>
    );
  }

  return renderMode(runContext.mode as RunMode);
}
"""


# =============================================================================
# Data structures
# =============================================================================

@dataclass
class Change:
    path: str
    action: str
    details: str


@dataclass
class Report:
    root: str
    dry_run: bool
    timestamp_utc: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    changed: List[Change] = field(default_factory=list)
    created: List[Change] = field(default_factory=list)
    skipped: List[Change] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    verification: Dict[str, bool] = field(default_factory=dict)

    def add(self, bucket: str, path: str, action: str, details: str) -> None:
        getattr(self, bucket).append(Change(path=path, action=action, details=details))


class PatchError(RuntimeError):
    pass


# =============================================================================
# Helpers
# =============================================================================

def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def ensure_exists(root: Path) -> None:
    missing = [rel for rel in REQUIRED_PATHS if not (root / rel).exists()]
    if missing:
        raise PatchError(
            "Repo root does not match expected Strategy A layout. Missing: " + ", ".join(missing)
        )


def insert_after_last_import(text: str, line: str) -> str:
    if line.strip() in text:
        return text
    matches = list(re.finditer(r"^(import[^\n]*\n(?:import[^\n]*\n)*)", text, flags=re.MULTILINE))
    if not matches:
        raise PatchError("Could not find import block for import insertion")
    last = matches[-1]
    insertion_point = last.end()
    return text[:insertion_point] + line + text[insertion_point:]


def backup_file(src: Path, backup_root: Path) -> None:
    rel = src.as_posix().lstrip("/")
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def replace_once(text: str, pattern: str, repl: str, *, flags: int = 0, context: str = "") -> str:
    new_text, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise PatchError(f"Expected one match for {context or pattern!r}, got {count}")
    return new_text


def ensure_line_after_anchor(text: str, anchor_pattern: str, line: str, *, flags: int = re.MULTILINE) -> str:
    if line.strip() in text:
        return text
    match = re.search(anchor_pattern, text, flags=flags)
    if not match:
        raise PatchError(f"Anchor not found: {anchor_pattern}")
    idx = match.end()
    return text[:idx] + line + text[idx:]


def normalize_newlines(text: str) -> str:
    return text.replace("\r\n", "\n")


# =============================================================================
# Patchers
# =============================================================================

def patch_engine_file(text: str, spec: dict) -> str:
    text = normalize_newlines(text)

    import_line = spec["import_line"]
    class_name = spec["class_name"]
    engine_id = spec["engine_id"]

    if "EngineInitParams" not in text or "EngineId" not in text or "../zero/types" not in text:
        text = insert_after_last_import(text, import_line)

    if "engineId" not in text:
        class_pattern = rf"(export class\s+{re.escape(class_name)}[^{{]*\{{\n)"
        engine_decl = f"  public readonly engineId: EngineId = EngineId.{engine_id};\n"
        text = replace_once(text, class_pattern, rf"\1{engine_decl}", context=f"{class_name}.engineId")

    if "init(params: EngineInitParams)" not in text:
        if class_name == "TimeEngine":
            init_method = (
                "  public init(params: EngineInitParams): void {\n"
                "    this.setSeasonBudget(params.seasonTickBudget);\n"
                "    this.reset();\n"
                "  }\n\n"
            )
        else:
            init_method = (
                "  public init(params: EngineInitParams): void {\n"
                "    this.reset();\n"
                "  }\n\n"
            )
        text = replace_once(
            text,
            r"(\n\s*(?:public\s+)?reset\(\):\s*void\s*\{)",
            "\n" + init_method + r"\1",
            flags=re.MULTILINE,
            context=f"{class_name}.init",
        )

    return text


def patch_run_store(text: str) -> str:
    text = normalize_newlines(text)

    if "export type RunPhase =" not in text:
        text = replace_once(
            text,
            r"(import \{ immer \}\s+from 'zustand/middleware/immer';\n)",
            "\\1\nexport type RunPhase = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED';\n",
            flags=re.MULTILINE,
            context="runStore.RunPhase",
        )

    if not re.search(r"\brunPhase:\s*RunPhase;", text):
        text = replace_once(
            text,
            r"(isInitialized:\s*boolean;\n)",
            r"\1  runPhase: RunPhase;\n",
            flags=re.MULTILINE,
            context="runStore.state.runPhase",
        )

    if not re.search(r"\bsetRunPhase:\s*\(phase:\s*RunPhase\)\s*=>\s*void;", text):
        text = replace_once(
            text,
            r"(reset:\s*\(\)\s*=>\s*void;\n)",
            r"\1  setRunPhase: (phase: RunPhase) => void;\n",
            flags=re.MULTILINE,
            context="runStore.actions.setRunPhase",
        )

    if not re.search(r"runPhase:\s*'IDLE'", text):
        text = replace_once(
            text,
            r"(isInitialized:\s*false,\n)",
            r"\1  runPhase:          'IDLE',\n",
            flags=re.MULTILINE,
            context="runStore.initial.runPhase",
        )

    if "setRunPhase: (phase) => set((state) => {" not in text:
        text = replace_once(
            text,
            r"(\n\s*reset:\s*\(\)\s*=>\s*set\(\(\)\s*=>\s*\(\{\s*\.\.\.INITIAL_STATE\s*\}\)\),\n)",
            (
                r"\1"
                "\n"
                "        setRunPhase: (phase) => set((state) => {\n"
                "          state.runPhase    = phase;\n"
                "          state.lastUpdated = Date.now();\n"
                "        }),\n"
            ),
            flags=re.MULTILINE,
            context="runStore.impl.setRunPhase",
        )

    if not re.search(r"state\.runPhase\s*=\s*'IDLE';", text):
        text = replace_once(
            text,
            r"(state\.isInitialized\s*=\s*true;\n)",
            r"\1          state.runPhase      = 'IDLE';\n",
            flags=re.MULTILINE,
            context="runStore.initialize.runPhase",
        )

    if "export const selectRunPhase" not in text:
        text = replace_once(
            text,
            r"(export const selectIsInitialized\s+=\s+\(s: RunStoreSlice\) => s\.isInitialized;\n)",
            r"\1export const selectRunPhase          = (s: RunStoreSlice) => s.runPhase;\n",
            flags=re.MULTILINE,
            context="runStore.selector.runPhase",
        )

    return text


def patch_engine_store(text: str) -> str:
    text = normalize_newlines(text)

    run_started_block = (
        "  eventBus.on('RUN_STARTED', (e: any) => {\n"
        "    const p = e.payload;\n"
        "    const rs = runStore.getState();\n"
        "    rs.initialize(p.runId, p.userId, p.seed);\n"
        "    rs.setRunPhase('RUNNING');\n"
        "  });\n\n"
    )
    run_ended_block = (
        "\n  eventBus.on('RUN_ENDED', () => {\n"
        "    runStore.getState().setRunPhase('ENDED');\n"
        "  });\n\n"
    )

    if "rs.setRunPhase('RUNNING');" not in text:
        text = replace_once(
            text,
            r"(\n\s*// ── Engine 0: Run Lifecycle — wired LAST so all slices reset atomically ──────\n)",
            r"\1" + run_started_block,
            flags=re.MULTILINE,
            context="engineStore.RUN_STARTED.runStore",
        )

    if "runStore.getState().setRunPhase('ENDED');" not in text:
        text = replace_once(
            text,
            r"(\n\s*eventBus\.on\('RUN_ENDED', \(e: any\) => \{\n)",
            run_ended_block + r"\1",
            flags=re.MULTILINE,
            context="engineStore.RUN_ENDED.runStore",
        )

    return text


def patch_index(text: str) -> str:
    text = normalize_newlines(text)
    export_line = "export { bootstrapEngine } from './bootstrap';\n"
    if export_line.strip() in text:
        return text
    text = replace_once(
        text,
        r"(export \{ sharedEventBus \} from './zero/EventBus';\n)",
        r"\1" + export_line,
        flags=re.MULTILINE,
        context="index.bootstrapExport",
    )
    return text


# =============================================================================
# Verification
# =============================================================================

def verify(root: Path) -> Dict[str, bool]:
    results: Dict[str, bool] = {}

    for spec in ENGINE_SPECS:
        text = read_text(root / spec["rel"])
        key_base = spec["class_name"]
        results[f"{key_base}.engineId"] = f"EngineId.{spec['engine_id']}" in text and "engineId" in text
        results[f"{key_base}.init"] = "init(params: EngineInitParams)" in text

    run_store = read_text(root / RUN_STORE_REL)
    results["runStore.runPhase"] = bool(re.search(r"runPhase:\s*RunPhase;", run_store)) and bool(re.search(r"setRunPhase:\s*\(phase:\s*RunPhase\)\s*=>\s*void;", run_store)) and "setRunPhase: (phase) => set((state) => {" in run_store

    engine_store = read_text(root / ENGINE_STORE_REL)
    results["engineStore.runPhaseWiring"] = "rs.setRunPhase('RUNNING');" in engine_store and "runStore.getState().setRunPhase('ENDED');" in engine_store

    use_game_loop = read_text(root / USE_GAME_LOOP_REL)
    results["useGameLoop.correctImport"] = "import { orchestrator as engineOrchestrator } from '../zero/EngineOrchestrator';" in use_game_loop
    results["useGameLoop.realSelectors"] = "s.run.lastTickIndex" in use_game_loop and "s.run.lastTickDurationMs" in use_game_loop

    bootstrap = root / BOOTSTRAP_REL
    results["bootstrap.exists"] = bootstrap.exists() and "export function bootstrapEngine" in read_text(bootstrap)

    index_text = read_text(root / INDEX_REL)
    results["index.exportsBootstrap"] = "export { bootstrapEngine } from './bootstrap';" in index_text

    game_shell = read_text(root / GAME_SHELL_REL)
    results["gameShell.noViteRedirect"] = "NEXT_PUBLIC_GAME_URL" not in game_shell and "window.location.href" not in game_shell
    results["gameShell.usesBootstrap"] = "bootstrapEngine({ force: true })" in game_shell and "orchestrator.startRun" in game_shell

    return results


# =============================================================================
# Main orchestration
# =============================================================================

def apply_file_patch(
    root: Path,
    rel: str,
    patcher: Callable[[str], str],
    report: Report,
    *,
    apply: bool,
    backup_root: Optional[Path],
) -> None:
    path = root / rel
    original = read_text(path)
    updated = patcher(original)

    if updated == original:
        report.add("skipped", rel, "noop", "already satisfied")
        return

    if apply:
        if backup_root is not None:
            backup_file(path, backup_root)
        write_text(path, updated)
    report.add("changed", rel, "patch", "updated in-place" if apply else "would update in-place")


def create_or_replace(
    root: Path,
    rel: str,
    content: str,
    report: Report,
    *,
    apply: bool,
    backup_root: Optional[Path],
) -> None:
    path = root / rel
    existed = path.exists()
    old = read_text(path) if existed else None

    if existed and old == content:
        report.add("skipped", rel, "noop", "already matches template")
        return

    if apply:
        if existed and backup_root is not None:
            backup_file(path, backup_root)
        write_text(path, content)

    bucket = "changed" if existed else "created"
    action = "replace" if existed else "create"
    detail = "replaced with template" if apply else f"would {action} from template"
    report.add(bucket, rel, action, detail)


def build_backup_root(root: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return root / ".pzo-patches" / f"strategy-a-fix-{stamp}"


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Patch PZO Strategy A blockers for Next.js engine execution.")
    parser.add_argument("--root", required=True, help="Repo root (point_zero_one_master / point_zero_one_game checkout root)")
    parser.add_argument("--apply", action="store_true", help="Write changes. Default is dry-run.")
    parser.add_argument("--report-json", help="Write a JSON report to this path.")
    args = parser.parse_args(argv)

    root = Path(args.root).expanduser().resolve()
    report = Report(root=str(root), dry_run=not args.apply)

    try:
        ensure_exists(root)
        backup_root = build_backup_root(root) if args.apply else None

        for spec in ENGINE_SPECS:
            apply_file_patch(
                root,
                spec["rel"],
                lambda text, spec=spec: patch_engine_file(text, spec),
                report,
                apply=args.apply,
                backup_root=backup_root,
            )

        create_or_replace(
            root,
            USE_GAME_LOOP_REL,
            USE_GAME_LOOP_TEMPLATE,
            report,
            apply=args.apply,
            backup_root=backup_root,
        )

        apply_file_patch(
            root,
            RUN_STORE_REL,
            patch_run_store,
            report,
            apply=args.apply,
            backup_root=backup_root,
        )

        apply_file_patch(
            root,
            ENGINE_STORE_REL,
            patch_engine_store,
            report,
            apply=args.apply,
            backup_root=backup_root,
        )

        create_or_replace(
            root,
            BOOTSTRAP_REL,
            BOOTSTRAP_TEMPLATE,
            report,
            apply=args.apply,
            backup_root=backup_root,
        )

        apply_file_patch(
            root,
            INDEX_REL,
            patch_index,
            report,
            apply=args.apply,
            backup_root=backup_root,
        )

        create_or_replace(
            root,
            GAME_SHELL_REL,
            GAME_SHELL_TEMPLATE,
            report,
            apply=args.apply,
            backup_root=backup_root,
        )

        # Verification runs against filesystem state. For dry-run, simulate by
        # requiring --apply? No. We verify only after apply, and in dry-run we emit
        # a best-effort skipped map.
        if args.apply:
            report.verification = verify(root)
            failed = [k for k, v in report.verification.items() if not v]
            if failed:
                report.errors.append("Verification failed: " + ", ".join(failed))
        else:
            report.warnings.append("Verification skipped in dry-run mode. Re-run with --apply to verify filesystem state.")

    except Exception as exc:  # noqa: BLE001
        report.errors.append(str(exc))

    if args.report_json:
        report_path = Path(args.report_json).expanduser().resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(
                {
                    "root": report.root,
                    "dry_run": report.dry_run,
                    "timestamp_utc": report.timestamp_utc,
                    "changed": [c.__dict__ for c in report.changed],
                    "created": [c.__dict__ for c in report.created],
                    "skipped": [c.__dict__ for c in report.skipped],
                    "warnings": report.warnings,
                    "errors": report.errors,
                    "verification": report.verification,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    print(f"[PZO Strategy A] root={report.root}")
    print(f"[PZO Strategy A] mode={'APPLY' if args.apply else 'DRY-RUN'}")
    print(f"[PZO Strategy A] changed={len(report.changed)} created={len(report.created)} skipped={len(report.skipped)} errors={len(report.errors)}")

    for change in report.changed:
        print(f"PATCH  {change.path} :: {change.details}")
    for change in report.created:
        print(f"CREATE {change.path} :: {change.details}")
    for change in report.skipped:
        print(f"SKIP   {change.path} :: {change.details}")
    for warning in report.warnings:
        print(f"WARN   {warning}")
    for error in report.errors:
        print(f"ERROR  {error}")
    if report.verification:
        print("[PZO Strategy A] verification")
        for key, value in sorted(report.verification.items()):
            print(f"  {'OK' if value else 'FAIL'}  {key}")

    return 1 if report.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
