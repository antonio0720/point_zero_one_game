# PZO ENGINE EXTRACTION — STEP-BY-STEP GUIDE
## Sections 1B + 1C: Move pzo-web engines into frontend/packages/engine
### Density6 LLC · March 2026 · Confidential

---

## BEFORE YOU START

**Time estimate:** 4-6 hours focused work
**Risk level:** Medium — you have `.bak` files and Strategy B as fallback
**Prerequisite:** All previous roadmap sections (1A, 2, 3A-3C, 4, 5) complete ✅

**The goal:** After this, the Next.js app imports engines directly. No more
Vite app redirect. One unified app. GameShell.tsx switches from redirect
to direct engine mount.

---

## WHAT YOU'RE ACTUALLY MOVING

```
107 engine files across 12 directories
  4 GameScreen files
  9 sibling component files (GameBoard, BattleHUD, ShieldIcons, etc.)
  6 store files
  7 hook files
  1 data file (mechanicsLoader)
  4 game/modes files (designTokens, empireConfig, etc.)
────────────────────
~138 files total
```

### THE GOOD NEWS

159 same-directory imports (./types, ./ShieldEngine, etc.) survive the copy
with ZERO changes because the internal directory structure is preserved.

144 cross-engine imports (../zero/EventBus, ../battle/types, etc.) ALSO
survive with ZERO changes because you're copying all 12 directories together
into the same parent.

### THE ONLY IMPORTS THAT NEED FIXING

Only ~12 unique import paths reach OUTSIDE the engines directory. These are
the ones you need to rewrite:

```
../../store/engineStore           → needs to come along
../../store/engineStore.card-slice → needs to come along
../../store/mechanicsRuntimeStore → needs to come along
../../store/runStore              → needs to come along
../../hooks/useGameLoop           → needs to come along
../../data/mechanicsLoader        → needs to come along
../../game/modes/shared/designTokens → needs to come along
../../game/modes/empire/*         → needs to come along
```

**Solution:** Don't just copy engines — copy the supporting files too.
Then the relative imports stay the same.

---

## PHASE 1: CREATE THE PACKAGE STRUCTURE (10 minutes)

```bash
ROOT="/Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master"
cd "$ROOT"

# Create the package directory
mkdir -p frontend/packages/engine/src
```

### 1.1 Create package.json

Create this file at `frontend/packages/engine/package.json`:

```json
{
  "name": "@pzo/engine",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "zustand": "^4.0.0"
  }
}
```

### 1.2 Create tsconfig.json

Create this file at `frontend/packages/engine/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@pzo/engine/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts", "**/*.bak*"]
}
```

---

## PHASE 2: COPY ENGINE DIRECTORIES (15 minutes)

The key insight: copy the ENTIRE directory structure so internal
relative imports stay valid.

```bash
cd "$ROOT"

# ─── Copy all 12 engine directories ──────────────────────────────────────
cp -r pzo-web/src/engines/zero/        frontend/packages/engine/src/zero/
cp -r pzo-web/src/engines/core/        frontend/packages/engine/src/core/
cp -r pzo-web/src/engines/modes/       frontend/packages/engine/src/modes/
cp -r pzo-web/src/engines/battle/      frontend/packages/engine/src/battle/
cp -r pzo-web/src/engines/cascade/     frontend/packages/engine/src/cascade/
cp -r pzo-web/src/engines/cards/       frontend/packages/engine/src/cards/
cp -r pzo-web/src/engines/pressure/    frontend/packages/engine/src/pressure/
cp -r pzo-web/src/engines/shield/      frontend/packages/engine/src/shield/
cp -r pzo-web/src/engines/sovereignty/ frontend/packages/engine/src/sovereignty/
cp -r pzo-web/src/engines/tension/     frontend/packages/engine/src/tension/
cp -r pzo-web/src/engines/time/        frontend/packages/engine/src/time/
cp -r pzo-web/src/engines/mechanics/   frontend/packages/engine/src/mechanics/

# ─── Clean up .bak files from the copy ───────────────────────────────────
find frontend/packages/engine/src/ -name "*.bak*" -delete
find frontend/packages/engine/src/ -name ".DS_Store" -delete

# ─── Verify ──────────────────────────────────────────────────────────────
echo "Engine files copied:"
find frontend/packages/engine/src/ -type f -name "*.ts" -o -name "*.tsx" | wc -l
```

---

## PHASE 3: COPY SUPPORTING FILES (20 minutes)

These files live outside `engines/` but are imported by engine files.
Copy them into the engine package so the relative imports still work.

```bash
cd "$ROOT"

# ─── Store files (imported by engines/modes/ModeRouter.ts and others) ─────
mkdir -p frontend/packages/engine/src/store
cp pzo-web/src/store/engineStore.ts              frontend/packages/engine/src/store/
cp pzo-web/src/store/engineStore.card-slice.ts    frontend/packages/engine/src/store/
cp pzo-web/src/store/engineStore.mechanics-slice.ts frontend/packages/engine/src/store/
cp pzo-web/src/store/engineStore.patch.ts         frontend/packages/engine/src/store/
cp pzo-web/src/store/mechanicsRuntimeStore.ts     frontend/packages/engine/src/store/
cp pzo-web/src/store/runStore.ts                  frontend/packages/engine/src/store/

# ─── Hooks (imported by GameScreens) ─────────────────────────────────────
mkdir -p frontend/packages/engine/src/hooks
cp pzo-web/src/hooks/useGameLoop.ts       frontend/packages/engine/src/hooks/
cp pzo-web/src/hooks/useCardEngine.ts     frontend/packages/engine/src/hooks/
cp pzo-web/src/hooks/useGameMode.ts       frontend/packages/engine/src/hooks/
cp pzo-web/src/hooks/useRunLifecycle.ts   frontend/packages/engine/src/hooks/
cp pzo-web/src/hooks/useRunState.ts       frontend/packages/engine/src/hooks/
cp pzo-web/src/hooks/useMechanicTelemetry.ts frontend/packages/engine/src/hooks/

# ─── Data files (imported by engines/mechanics) ──────────────────────────
mkdir -p frontend/packages/engine/src/data
cp pzo-web/src/data/mechanicsLoader.ts    frontend/packages/engine/src/data/
cp pzo-web/src/data/mlLoader.ts           frontend/packages/engine/src/data/
cp pzo-web/src/data/index.ts              frontend/packages/engine/src/data/
# Copy JSON data files too (mechanics_core.json, ml_core.json, etc.)
cp pzo-web/src/data/*.json                frontend/packages/engine/src/data/ 2>/dev/null

# ─── Game mode config files (imported by GameScreens) ────────────────────
mkdir -p frontend/packages/engine/src/game/modes/shared
mkdir -p frontend/packages/engine/src/game/modes/empire
cp pzo-web/src/game/modes/shared/designTokens.ts  frontend/packages/engine/src/game/modes/shared/
cp pzo-web/src/game/modes/empire/*.ts              frontend/packages/engine/src/game/modes/empire/ 2>/dev/null

# ─── Game core (format utils imported by App.tsx and screens) ─────────────
mkdir -p frontend/packages/engine/src/game/core
cp pzo-web/src/game/core/format.ts        frontend/packages/engine/src/game/core/ 2>/dev/null
cp pzo-web/src/game/core/constants.ts     frontend/packages/engine/src/game/core/ 2>/dev/null
```

### WHY THIS WORKS

The directory layout inside the engine package mirrors pzo-web/src/:

```
pzo-web/src/                    frontend/packages/engine/src/
├── engines/                    ├── zero/          ← was engines/zero/
│   ├── zero/                   ├── core/          ← was engines/core/
│   ├── core/                   ├── modes/         ← etc.
│   ├── modes/                  ├── ...
│   └── ...                     ├── store/         ← NEW (copied from src/store/)
├── store/                      ├── hooks/         ← NEW (copied from src/hooks/)
├── hooks/                      ├── data/          ← NEW (copied from src/data/)
├── data/                       └── game/          ← NEW (copied from src/game/)
└── game/
```

**The problem:** Engine files use imports like `../../store/engineStore`.
From `engines/modes/ModeRouter.ts`, `../../store` goes up two levels
to `src/`, then into `store/`.

In the new package, `modes/ModeRouter.ts` is at `src/modes/ModeRouter.ts`.
`../../store` would go to the PARENT of `src/` — wrong!

**The fix:** You need to adjust engine imports from `../../store` to `../store`.
This is because `engines/` is removed from the path (they're now directly
under `src/`, not under `src/engines/`).

---

## PHASE 4: FIX IMPORT PATHS (1-2 hours)

This is the core work. Every import that used to go `../../` to reach
store/hooks/data/game now only needs `../` because the engines are one
level higher in the directory tree.

### 4.1 Automated fix for ../../ → ../

```bash
cd "$ROOT/frontend/packages/engine"

# Fix ../../store → ../store
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
  sed -i '' 's|from '\''../../store/|from '\''../store/|g' {} +

# Fix ../../hooks → ../hooks
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
  sed -i '' 's|from '\''../../hooks/|from '\''../hooks/|g' {} +

# Fix ../../data → ../data
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
  sed -i '' 's|from '\''../../data/|from '\''../data/|g' {} +

# Fix ../../game → ../game
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
  sed -i '' 's|from '\''../../game/|from '\''../game/|g' {} +

# Fix ../../exec-compiled → remove (stub this if needed)
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
  sed -i '' 's|from '\''../../exec-compiled/|from '\''../exec-compiled/|g' {} +
```

### 4.2 Verify no broken ../../ imports remain

```bash
cd "$ROOT/frontend/packages/engine"

echo "=== REMAINING ../../ IMPORTS (should be 0) ==="
grep -rn "from '\.\.\/\.\.\/" src/ --include="*.ts" --include="*.tsx" | grep -v ".bak"
echo "(empty = clean)"
```

If any show up, fix them manually. They'll be edge cases — unusual paths
like `../../event/EventBus` or `../../engines/pressure` which are internal
engine references that got mis-pathed.

### 4.3 Fix the core/EngineOrchestrator.DEPRECATED.ts reference

Since you renamed it, make sure nothing in the copied engine package
imports it:

```bash
cd "$ROOT/frontend/packages/engine"

# Check for any imports of the deprecated file
grep -rn "EngineOrchestrator" src/core/ --include="*.ts" | head -5

# If the DEPRECATED file was copied, rename or delete it
mv src/core/EngineOrchestrator.DEPRECATED.ts src/core/EngineOrchestrator.DEPRECATED.ts.bak 2>/dev/null
# Or just delete it:
# rm src/core/EngineOrchestrator.DEPRECATED.ts 2>/dev/null
```

### 4.4 Fix store files that import from engines

The store files you copied also have imports pointing back to engines.
In pzo-web they used `../engines/zero/types`. In the package, `zero/`
is a sibling of `store/`, so it becomes `../zero/types`:

```bash
cd "$ROOT/frontend/packages/engine"

# Fix store → engines references
find src/store/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
  sed -i '' 's|from '\''../engines/|from '\''../|g' {} +

# Fix hooks → engines references
find src/hooks/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
  sed -i '' 's|from '\''../engines/|from '\''../|g' {} +
```

---

## PHASE 5: COPY GAME SCREENS + SIBLING COMPONENTS (20 minutes)

### 5.1 Copy the four GameScreens

```bash
cd "$ROOT"

mkdir -p frontend/packages/engine/src/screens

cp pzo-web/src/components/EmpireGameScreen.tsx    frontend/packages/engine/src/screens/
cp pzo-web/src/components/PredatorGameScreen.tsx   frontend/packages/engine/src/screens/
cp pzo-web/src/components/SyndicateGameScreen.tsx  frontend/packages/engine/src/screens/
cp pzo-web/src/components/PhantomGameScreen.tsx    frontend/packages/engine/src/screens/
```

### 5.2 Copy sibling components they depend on

```bash
mkdir -p frontend/packages/engine/src/components

cp pzo-web/src/components/GameBoard.tsx           frontend/packages/engine/src/components/
cp pzo-web/src/components/BattleHUD.tsx           frontend/packages/engine/src/components/
cp pzo-web/src/components/CounterplayModal.tsx     frontend/packages/engine/src/components/
cp pzo-web/src/components/EmpireBleedBanner.tsx    frontend/packages/engine/src/components/
cp pzo-web/src/components/MomentFlash.tsx          frontend/packages/engine/src/components/
cp pzo-web/src/components/RescueWindowBanner.tsx   frontend/packages/engine/src/components/
cp pzo-web/src/components/SabotageImpactPanel.tsx  frontend/packages/engine/src/components/
cp pzo-web/src/components/ShieldIcons.tsx          frontend/packages/engine/src/components/
cp pzo-web/src/components/AidContractComposer.tsx  frontend/packages/engine/src/components/
```

### 5.3 Fix GameScreen imports

The GameScreens currently import siblings with `./GameBoard`.
Now GameBoard is in `../components/GameBoard`:

```bash
cd "$ROOT/frontend/packages/engine"

# Fix GameScreen → sibling component imports
for screen in src/screens/*.tsx; do
  # ./GameBoard → ../components/GameBoard (etc.)
  sed -i '' "s|from './GameBoard'|from '../components/GameBoard'|g" "$screen"
  sed -i '' "s|from './BattleHUD'|from '../components/BattleHUD'|g" "$screen"
  sed -i '' "s|from './CounterplayModal'|from '../components/CounterplayModal'|g" "$screen"
  sed -i '' "s|from './EmpireBleedBanner'|from '../components/EmpireBleedBanner'|g" "$screen"
  sed -i '' "s|from './MomentFlash'|from '../components/MomentFlash'|g" "$screen"
  sed -i '' "s|from './RescueWindowBanner'|from '../components/RescueWindowBanner'|g" "$screen"
  sed -i '' "s|from './SabotageImpactPanel'|from '../components/SabotageImpactPanel'|g" "$screen"
  sed -i '' "s|from './ShieldIcons'|from '../components/ShieldIcons'|g" "$screen"
  sed -i '' "s|from './AidContractComposer'|from '../components/AidContractComposer'|g" "$screen"

  # ../store → same (already correct — screens go ../ to reach store/)
  # ../hooks → same
  # ../engines/core/types → ../core/types
  sed -i '' "s|from '../engines/|from '../|g" "$screen"
  # ../game/ stays the same
done
```

### 5.4 Fix sibling component imports

The sibling components (GameBoard, BattleHUD, etc.) may import from
engines and store too:

```bash
cd "$ROOT/frontend/packages/engine"

# Fix component → engines references
find src/components/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
  sed -i '' 's|from '\''../engines/|from '\''../|g' {} +

# Fix component → store references (../store stays same)
# Fix component → hooks references (../hooks stays same)
# These should already be correct since components/ is at the same level as store/
```

---

## PHASE 6: CREATE THE BARREL EXPORT (15 minutes)

Create `frontend/packages/engine/src/index.ts`:

```typescript
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
```

---

## PHASE 7: WIRE NEXT.JS TO USE THE PACKAGE (30 minutes)

### 7.1 Add the package to Next.js workspace

If you're using a monorepo tool (turborepo, pnpm workspaces, etc.),
add `@pzo/engine` to the workspace config. If not, use a relative
path in the Next.js app's package.json:

```json
{
  "dependencies": {
    "@pzo/engine": "file:../../packages/engine"
  }
}
```

Then run `npm install` or `pnpm install` from the Next.js app directory.

### 7.2 Update Next.js config to transpile the package

In `frontend/apps/web/next.config.js` (or `.mjs`/`.ts`):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@pzo/engine'],
  // ... your existing config
};

module.exports = nextConfig;
```

### 7.3 Update GameShell.tsx — Strategy A (replace redirect)

Replace the Strategy B redirect in `frontend/apps/web/app/(app)/game/GameShell.tsx`
with direct engine imports:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import {
  orchestrator,
  ModeRouter,
  EmpireGameScreen,
  PredatorGameScreen,
  SyndicateGameScreen,
  PhantomGameScreen,
} from '@pzo/engine';
import type { RunMode } from '@pzo/engine';

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

export default function GameShell({ runContext, onRunEnd, onBackToLobby }: GameShellProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    orchestrator.startRun({
      runId:            runContext.runId,
      userId:           'player_01',
      seed:             String(runContext.seed),
      seasonTickBudget: 720,
      freedomThreshold: 500_000,
      clientVersion:    '4.0.0',
      engineVersion:    '4.0.0',
    });

    return () => {
      orchestrator.endRun('ABANDONED');
    };
  }, [runContext]);

  // Mode routing
  switch (runContext.mode) {
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
```

### 7.4 Update play/page.tsx — revert to router.push

Since the game now runs inside Next.js, revert the Strategy B redirect
back to a Next.js route:

```bash
cd "$ROOT"

# Change window.location.href back to router.push
sed -i '' 's|// Strategy B: direct redirect to Vite engine (no intermediate SSR hop)|// Strategy A: game runs inside Next.js via @pzo/engine|' \
  "frontend/apps/web/app/(app)/play/page.tsx"

# Replace the window.location.href line with router.push
# (You may need to do this manually — the sed would be fragile)
```

In `play/page.tsx`, change the redirect block to:

```typescript
// Strategy A: game runs inside Next.js via @pzo/engine
sessionStorage.setItem('pzo_run_ctx', JSON.stringify(ctx));
router.push(`/game?runId=${ctx.runId}`);
```

---

## PHASE 8: VERIFY EVERYTHING (30 minutes)

### 8.1 TypeScript compilation check

```bash
cd "$ROOT/frontend/packages/engine"

# Install dependencies (zustand, react)
npm install

# Check for type errors
npx tsc --noEmit 2>&1 | head -50

# Count errors
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expect some errors on first pass. Common fixes:

| Error | Fix |
|-------|-----|
| Cannot find module '../store/...' | Missing file — copy it from pzo-web |
| Cannot find module '../game/...' | Missing file — copy it from pzo-web |
| Type 'X' is not assignable to 'Y' | Usually import path issue — check relative path |
| Cannot find name 'import.meta' | Add `"types": ["vite/client"]` to tsconfig or replace with `process.env` |

### 8.2 Test the Next.js app

```bash
cd "$ROOT/frontend/apps/web"

# Start the dev server
npm run dev

# Test: go to http://localhost:3000/play
# Select mode → Configure → CONFIRM & START RUN
# Should render the GameScreen directly (no redirect to Vite)
```

### 8.3 Verify all 4 modes

| Mode | URL params | Expected Screen |
|------|-----------|----------------|
| solo | mode=solo | EmpireGameScreen |
| asymmetric-pvp | mode=asymmetric-pvp | PredatorGameScreen |
| co-op | mode=co-op | SyndicateGameScreen |
| ghost | mode=ghost | PhantomGameScreen |

---

## PHASE 9: CLEAN UP (15 minutes)

### 9.1 Remove Strategy B code from pzo-web/src/App.tsx

The AUTO-START FROM NEXT.JS code and the mode-specific GameScreen routing
in App.tsx are no longer needed. You can remove them or leave them as
dead code (they only activate when `?from=nextjs` is in the URL).

### 9.2 Keep pzo-web as dev/test harness

Don't delete the Vite app yet. It's useful for:
- Standalone engine development without Next.js overhead
- Running engine unit tests
- Quick iteration on GameScreen layouts

### 9.3 Update .gitignore

Add to your root `.gitignore`:

```
frontend/packages/engine/dist/
frontend/packages/engine/node_modules/
```

---

## TROUBLESHOOTING

### "Module not found: @pzo/engine"
- Check `transpilePackages` in next.config
- Check the dependency in package.json uses the right relative path
- Run `npm install` again

### "Cannot use import statement outside a module"
- The engine package needs to be transpiled by Next.js
- Ensure `transpilePackages: ['@pzo/engine']` is set

### "zustand not found" or "react not found"
- These are peerDependencies — they should be installed in the Next.js app
- Run `npm install zustand` in `frontend/apps/web/` if missing

### "window is not defined" (SSR error)
- GameScreens use browser APIs — they must be client components
- Ensure GameShell.tsx has `'use client'` at the top
- Ensure all GameScreen imports are inside client components

### "Hydration mismatch"
- Canvas elements (ParticleField) and dynamic content cause this
- Wrap with `dynamic(() => import(...), { ssr: false })` if needed

### Some engine files import from paths that don't exist
- Run `grep -rn "from '\.\./" src/ | grep -v node_modules` to find them
- Most will be edge cases — copy the missing file or stub it

---

## CHECKLIST: MARK EACH STEP COMPLETE

```
[ ] Phase 1: Package structure created (package.json, tsconfig.json)
[ ] Phase 2: 12 engine directories copied
[ ] Phase 3: Supporting files copied (store, hooks, data, game)
[ ] Phase 4: Import paths fixed (../../ → ../)
[ ] Phase 4: No remaining ../../ imports verified
[ ] Phase 5: 4 GameScreens + 9 sibling components copied
[ ] Phase 5: GameScreen imports fixed (./X → ../components/X)
[ ] Phase 6: Barrel export (index.ts) created
[ ] Phase 7: Next.js wired (@pzo/engine dependency + transpilePackages)
[ ] Phase 7: GameShell.tsx updated (Strategy A — direct engine mount)
[ ] Phase 7: play/page.tsx reverted (router.push instead of redirect)
[ ] Phase 8: TypeScript compiles with 0 errors
[ ] Phase 8: All 4 modes render correctly
[ ] Phase 9: Cleanup done
```

---

*Engine Extraction Guide · Density6 LLC · Point Zero One · Confidential*
