# PZO Data — Point Zero One Game Registry
## One Folder. Everything.

pzo-web/src/data/
├── mechanics_core.json          ← 150 CORE mechanics (Vite import → buildCatalog)
├── mechanics_core.ndjson        ← Same, 1 mechanic per line (source of truth)
├── mechanics_batch_1.ndjson     ← M01–M50   (core loop, economy, cards, risk)
├── mechanics_batch_2.ndjson     ← M51–M100  (co-op, portfolio, integrity)
├── mechanics_batch_3.ndjson     ← M101–M150 (advanced, competitive, cosmetics)
├── mechanicsLoader.ts           ← TypeScript interface for core mechanics
│
├── ml_core.json                 ← 150 ML mechanics (Vite import → mlRuntime)
├── ml_core.ndjson               ← Same, 1 ML mechanic per line (source of truth)
├── ml_batch_1.ndjson            ← M01a–M50a
├── ml_batch_2.ndjson            ← M51a–M100a
├── ml_batch_3.ndjson            ← M101a–M150a
├── mlLoader.ts                  ← TypeScript interface for ML mechanics
│
├── combined_tasks_book.json     ← ALL 300 tasks in one file (PZO-M001 → PZO-ML150)
└── tasks_book.json              ← Core mechanics only task book (legacy)

## What each file does

### The .json files (mechanics_core.json, ml_core.json)
These are what your GAME IMPORTS. Vite resolves them at build time.
In App.tsx:
  import MECHANICS from './data/mechanics_core.json'
  import ML from './data/ml_core.json'

### The .ndjson files
Source of truth. 1 record per line. Easy to grep, diff, and regenerate.
When you implement a mechanic, update status here, regenerate the .json.

### The _batch_ files
Work files. 50 mechanics at a time. Use these to implement in batches
without opening the full 150-record file.

### combined_tasks_book.json
Your project task board. 300 tasks. PZO-M001 through PZO-ML150.
Paste into Linear/Notion/GitHub Issues as your implementation roadmap.

## How Core + ML connect

Every core mechanic M## has a ML companion M##a:
  M03 (Solvency Wipe Conditions)
  └── M03a (Solvency Collapse Predictor)
        Reads: state.cash, state.income, state.regime
        Writes: intelligence.risk
        Currently: heuristic in IntelligenceState (already live)
        Replace with: trained gradient boosted tree after 100 runs

## TOTAL: 300 mechanics. 300 task IDs. One folder.
