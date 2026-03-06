# PZO ML Full Upgrade — Deployment Guide

**What this does:** Upgrades all 148 ML stub mechanics (M03A–M150A) from ~250-line fallback stubs to ~730-line production implementations matching the M01A/M02A architectural pattern.

**Before:** Each ML file returned `score: 0.5` with no inference, no learning, no session tracking.

**After:** Each ML file includes:
- Input sanitization with PII privacy filtering
- Domain-specific feature extraction (9 families: market, balance, integrity, social, contract, economy, progression, forensics, co_op)
- Three-tier inference: baseline (logistic) → sequence_dl (temporal encoder) → policy_rl (offline policy prior)
- Session profiling with exponential moving average (EMA) learning
- Bandit exploration for policy decisions
- Signed audit receipts with SHA-256 hashing
- Monotonic constraints + competitive lock-off support
- Export/hydrate/reset functions for durable state persistence

**Total new code:** ~80,750 lines of TypeScript across 148 files

## Deploy Commands

```bash
# ── 1. Copy files to your machine ──────────────────────────────────
# Save pzo_ml_full_upgrade.patch and upgrade_ml_mechanics.py from Claude's output

cp ~/Downloads/pzo_ml_full_upgrade.patch \
   /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/

cp ~/Downloads/upgrade_ml_mechanics.py \
   /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/scripts/

# ── 2. Navigate to repo ────────────────────────────────────────────
cd /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master

# ── 3. Create branch ──────────────────────────────────────────────
git checkout -b upgrade/ml-full-implementations

# ── 4. Apply patch ─────────────────────────────────────────────────
git apply --check pzo_ml_full_upgrade.patch
git apply pzo_ml_full_upgrade.patch

# ── 5. Verify zero ML errors ──────────────────────────────────────
cd pzo_engine
npx tsc --noEmit 2>&1 | grep "src/ml/" | wc -l
# Expected: 0

# ── 6. Verify no throws ───────────────────────────────────────────
grep -rl "throw new Error" src/ml/m*a_*.ts | grep -v "m01a_\|m02a_" | wc -l
# Expected: 0

# ── 7. Verify line counts ─────────────────────────────────────────
wc -l src/ml/m*a_*.ts | tail -1
# Expected: ~110,000 total

# ── 8. Commit + push ──────────────────────────────────────────────
cd ..
git add -A
git commit -m "feat: Full ML implementation for all 148 mechanics

- Every ML mechanic now has production-grade inference (baseline/sequence/policy)
- Domain-specific feature extraction for 9 families
- Session learning with EMA, bandit exploration, audit receipts
- 80,750 new lines across 148 files
- Zero TypeScript errors in src/ml/"

git push -u origin upgrade/ml-full-implementations

# ── 9. Merge to main ──────────────────────────────────────────────
git checkout main
git merge upgrade/ml-full-implementations
git push origin main

# ── 10. Cleanup ────────────────────────────────────────────────────
rm pzo_ml_full_upgrade.patch
```
