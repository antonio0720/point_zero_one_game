# PZO Engine — Day-1 Readiness Audit & Roadmap

**Date:** 2026-03-05  
**Repo:** `antonio0720/point_zero_one_game`  
**Scope:** `pzo_engine/` package — ML mechanics, build integrity, startup readiness

---

## Fixes Applied (This Patch)

### 1. Build Blocker Fixed: `m112_precision_split_sell_part_keep_part.ts`

The `import type { ... }` block was syntactically broken — `export interface SplitResult` was interleaved inside the import statement, causing 13 TS parse errors. The import and interface are now correctly separated.

### 2. 148 ML Stub Fallbacks — No Longer Throw

Every ML mechanic from M03A through M150A had both `runMxxaMl()` and `runMxxaMlFallback()` functions that threw `new Error(...)`. The fallback functions are explicitly documented as "must never throw" — they are the safety net for when ML inference is unavailable.

**What changed per file:**

- Added `import { createHash } from 'node:crypto'` for deterministic audit hash generation
- `runMxxaMlFallback()` now returns a valid neutral/degraded `MxxAOutput` with `score: 0.5`, audit hash, and all extended fields nulled
- `runMxxaMl()` now delegates to the fallback instead of throwing, with a comment noting this is the day-1 operational path

**This means:** From second 1, any code calling any ML mechanic will get a valid, auditable, non-throwing response. The game runs in degraded-but-operational mode across all 150 ML dimensions.

### 3. MLMechanicsRouter.ts — Already Removed

No trace of this file or any import referencing it exists in the current repo. Non-issue.

### 4. `ml/runtime/` Directory — Confirmed Needed

Contrary to the earlier analysis, `ml/runtime/` IS required in the repo. M01A (Seed Integrity) imports directly from it: `canonical-json.ts`, `privacy.ts`, `math.ts`, `m01a-features.ts`, `m01a-runtime.ts`, and `m01a-feedback.ts`. M02A does NOT use it (self-contained via `mechanicsUtils`). The runtime directory is M01A-specific infrastructure for its online logistic regression learning loop.

---

## Pre-Existing Errors (Not Caused by This Patch)

The `tsc --noEmit` check shows 159 errors in files outside `src/ml/`. These are organized by priority:

### Priority 1 — API Layer (5 files, ~20 errors)

`src/api/server.ts`, `auth.ts`, `catalog.ts`, `health.ts`, `replay.ts`, `runs.ts`, `validate.ts`

**Root cause:** Missing `express` and `cors` type declarations (`npm install --save-dev @types/express @types/cors`), plus missing module paths (`./routes/runs`, `./routes/replay`, etc. — files don't exist or are mispathed).

**Fix:** Install `@types/express` + `@types/cors` as devDeps. Create or fix route module paths.

### Priority 2 — Demo Layer (5 files, ~114 errors)

`src/demo/DemoAI.ts`, `DemoOrchestrator.ts`, `DemoNarrator.ts`, `demo-config.ts`, `run-demo.ts`

**Root cause:** Demo files import from `../../../pzo-web/src/game/` which is outside `rootDir`. Types have drifted — `CardInHand` lost `.id`, `.name`, `.cost` fields; `GameMode` enum values changed from `"EMPIRE"/"PREDATOR"/"SYNDICATE"/"PHANTOM"` to something else; `RunState` missing `modeExt`; `RescueWindow` missing `isOpen`.

**Fix:** Two options:
1. **Exclude demo from build** — add `"src/demo/**/*"` to `tsconfig.json` excludes (the build config already does this)
2. **Fix demo types** — align with current `pzo-web` type definitions

Since `tsconfig.build.json` already excludes `src/demo/**/*`, running `tsc -p tsconfig.build.json --noEmit` should eliminate these.

### Priority 3 — Config & Index (3 files, ~14 errors)

`src/config/mode-config.ts` — missing exports `TRUST_DECAY_PM`, `DYNASTY_CHALLENGES_FOR_SOVEREIGN`, `CORD_MODE_BONUS_BLEED_RECOVERY` from `pzo_constants`

`src/index.ts` — duplicate identifiers (`RunPhase`, `RunIdentity`), missing exports (`MODE_EMPIRE_CONFIG`, etc.), wrong export name (`createRunStore` vs `getRunStore`)

**Fix:** Audit `pzo_constants.ts` for missing constants; clean up re-export conflicts in `index.ts`.

### Priority 4 — Integrity (2 files, ~8 errors)

`src/integrity/index.ts` and `replay-validator.ts` — missing exports from `proof-hash.ts` (`verifyProofHash`, `computeTickStreamChecksum`, etc.)

**Fix:** Add missing function implementations to `proof-hash.ts` or update exports.

### Priority 5 — Minor (2 files, 2 errors)

`src/cards/catalog-loader.ts` — uses `import.meta` with `commonjs` module (needs `"module": "node16"` or restructure)

`src/mechanics/m44_archetype_starter_kit.ts` — missing `PlayerProfile` type export from `types.ts`

---

## What's Still Needed for "Learn From Every Event"

The ML fallbacks now provide day-1 operational safety. For the full learning loop, each ML mechanic needs three capabilities wired in:

### A. Telemetry Intake

Each ML mechanic declares `TELEMETRY_EVENTS` (currently empty arrays `[]` in most stubs). The engine's event bus needs to route matching events to the correct ML mechanic's `runMxxaMl()` call.

**Pattern:** M02A shows the target architecture — it subscribes to `M02_TICK_COMPLETE`, `M02_PHASE_TRANSITION`, etc.

### B. Durable State Persistence

M02A uses in-memory `Map` storage (`m02aSessionStore`) which resets on restart. M01A uses `MLStore` (SQLite via `better-sqlite3`). For production:

- Each mechanic needs its session state serializable via `exportMxxaLearningState()` / `hydrateMxxaLearningState()`
- A persistence layer must save/load this state across restarts (the `MLStore` pattern from M01A is the right model)
- The SQLite schema migration in `persistence/schema.ts` needs the `ml_models`, `ml_observations`, and `ml_feedback` tables

### C. Online Learning / Feedback Loop

M01A's `runtime/online-logistic.ts` shows the pattern: online logistic regression with bounded step sizes, L2 regularization, and weight clamps. Each mechanic's full implementation should follow this architecture rather than the static fallback.

---

## Recommended Execution Order

1. **Apply this patch** — clears all ML build errors immediately
2. **Run `tsc -p tsconfig.build.json --noEmit`** — verify build config excludes demo, reducing errors to ~45
3. **Fix Priority 1 (API)** — install missing type packages
4. **Fix Priority 3 (index/config)** — clean up export conflicts
5. **Fix Priority 4 (integrity)** — add missing proof-hash functions
6. **Wire telemetry events** — connect event bus to ML mechanics one family at a time
7. **Add persistence** — hydrate/export learning state per mechanic
8. **Implement full ML per mechanic** — following M01A/M02A as templates, one at a time

---

## How to Apply This Patch

```bash
cd /path/to/point_zero_one_game
git apply pzo_ml_day1_fix.patch
```

Or if you prefer to review first:

```bash
git apply --stat pzo_ml_day1_fix.patch   # see file list
git apply --check pzo_ml_day1_fix.patch  # dry run
git apply pzo_ml_day1_fix.patch          # apply
```
