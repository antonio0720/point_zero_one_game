# Point Zero One — Sovereign Schema v1.0

## Density6 LLC · Sovereign Infrastructure · RA-OMEGA Intelligence

---

## Quick Start

```bash
# Fresh install (idempotent — safe to run multiple times)
./run_migration.sh

# Nuclear rebuild (drops everything, rebuilds from scratch)
./run_migration.sh --nuke

# Verify schema integrity
./run_migration.sh --verify

# Parse-check only (no changes)
./run_migration.sh --dry-run
```

## Connection

Set `DATABASE_URL` or individual `PG*` variables:

```bash
# For PgBouncer (production — port 6432)
export DATABASE_URL="postgresql://pzo_service:PASSWORD@db-primary.internal:6432/pzo?sslmode=require"

# For direct Postgres (local dev — port 5432)
export DATABASE_URL="postgresql://pzo_service:PASSWORD@localhost:5432/pzo"
```

---

## Schema Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PUBLIC SCHEMA (core identity)               │
│  accounts · users · sessions · guest_sessions                   │
│  global_event_store · feature_flags · seasons                   │
│  notifications · referrals · experiments · host_os events       │
├─────────────────────────────────────────────────────────────────┤
│                     GAME SCHEMA (gameplay)                      │
│  runs · run_turns · run_events · run_outcomes · run_goals       │
│  run_card_plays · run_bot_states · shield_breaches              │
│  cascade_chains · pressure_journal · comeback_surges            │
│  hold_queue · case_files · decision_trees · counterfactuals     │
│  card_definitions · card_versions · deck_definitions            │
│  deck_compositions · ruleset_versions · content_versions        │
│  share_artifacts · card_forge_submissions · bloodlines          │
│  macro_events · alerts · liveops_board · verification_reports   │
│  run_appeals · generation_events                                │
├─────────────────────────────────────────────────────────────────┤
│                    ECONOMY SCHEMA (monetization)                │
│  billing_plans · invoices · invoice_line_items                  │
│  skus · purchases · entitlements · cosmetic_store_items         │
│  promo_codes · revshare_partners                                │
├─────────────────────────────────────────────────────────────────┤
│                    SOCIAL SCHEMA (multiplayer)                  │
│  matches · match_participants · battle_budgets                  │
│  extraction_actions · psyche_meters · rivalries                 │
│  spectator_sessions · spectator_bets                            │
│  shared_treasuries · treasury_transactions · trust_scores       │
│  defection_events · treasury_loans                              │
│  syndicates · syndicate_members · syndicate_duels               │
│  legend_runs · phantom_chases                                   │
├─────────────────────────────────────────────────────────────────┤
│                   ANALYTICS SCHEMA (reporting)                  │
│  run_scorecards · ladders · ladder_entries                      │
│  telemetry_raw · metric_rollups                                 │
├─────────────────────────────────────────────────────────────────┤
│                      B2B SCHEMA (institutional)                 │
│  tenants · tenant_seats · cohorts · cohort_members              │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Four Battlegrounds (Game Modes)

| Enum Value | Mode Name | Identity | Key Mechanic |
|---|---|---|---|
| `EMPIRE` | Go Alone | The Isolated Sovereign | Pressure Journal, Hold Queue, Bleed Mode, Comeback Surge |
| `PREDATOR` | Head to Head | The Financial Predator | Battle Budget, Extraction Actions, Counter-Play, Psyche Meter, Rivalries |
| `SYNDICATE` | Team Up | The Trust Architect | Shared Treasury, Trust Scores, Defection, Cascade Absorption, Syndicate Duels |
| `PHANTOM` | Chase a Legend | The Ghost Hunter | Legend Runs, Replay Integrity, Deviation Scoring, Shadow Pressure |

---

## Census (Target)

| Domain | Tables | Indexes | Enums |
|---|---|---|---|
| public | ~20 | ~50 | 49 |
| game | ~30 | ~80 | (shared from public) |
| economy | ~10 | ~25 | (shared) |
| social | ~18 | ~45 | (shared) |
| analytics | ~5 | ~20 | (shared) |
| b2b | ~4 | ~10 | (shared) |
| **TOTAL** | **~83** | **~229** | **49** |

---

## Key Design Decisions

### IDs
- `INTEGER` for entity tables (accounts, users, runs, cards) — 2.1B ceiling is fine for entities
- `BIGINT` for high-throughput tables (events, turns, telemetry, card plays, bot states) — future-proofed for billions of rows

### Money
- All monetary values stored as `BIGINT` with `_cents` suffix
- Never floats, never decimals for money
- Constraints enforce non-negative

### JSONB
- Every JSONB column has a `jsonb_typeof` constraint (`'object'` or `'array'`)
- GIN indexes on payload columns for fast querying
- Used for flexible data that varies per context (engine state, mode overrides, metadata)

### Indexes
- B-Tree for equality/range lookups
- BRIN for time-series columns (10-100x smaller than B-Tree for append-only data)
- GIN for JSONB containment and array queries
- Partial indexes for common filter predicates (`WHERE is_active = TRUE`, `WHERE status IN (...)`)
- Composite indexes for common query patterns (`user_id + game_mode + created_at`)

### PgBouncer Safety
- No session-level advisory locks
- No `SET` commands in transactions
- `search_path` set at database level, not session level
- All constraint names are globally unique to avoid collision in pooled connections

### Streaming Replication Ready
- All tables use `GENERATED BY DEFAULT AS IDENTITY` (not `GENERATED ALWAYS`) so standby promotion works cleanly
- No sequence-dependent logic that would break on failover
- BRIN indexes on time columns enable efficient WAL-based replication monitoring

---

## What Changed from the Old Schema

1. **Game modes renamed**: `GO_ALONE` → `EMPIRE`, `HEAD_TO_HEAD` → `PREDATOR`, `TEAM_UP` → `SYNDICATE`, `CHASE_A_LEGEND` → `PHANTOM`
2. **Missing `users` and `sessions` tables** — now properly created with FKs
3. **75 fragmented migrations → 1 unified schema** — no more ordering conflicts or duplicate type definitions
4. **Schema separation** — game, economy, social, analytics, b2b each get their own namespace
5. **All game mechanics have tables** — Battle Budget, Extraction Actions, Psyche Meter, Rivalries, Trust Scores, Defection, Shared Treasury, Legend Runs, Phantom Chases, Pressure Journal, Comeback Surges, Hold Queue, Case Files, etc.
6. **Proper BIGINT on hot tables** — run_events, run_turns, telemetry, card plays
7. **BRIN indexes on time columns** — 100x more efficient for append-only time-series
8. **MySQL syntax removed** — no more `ALTER TABLE ... ADD INDEX`, no `AUTO_INCREMENT`
9. **Duplicate table definitions resolved** — cohorts, experiments, entitlements each defined once
10. **Production constraints** — every text column has a `NOT BLANK` check, every JSONB has a typeof check, every money column is non-negative

---

## File Structure

```
migrations/
├── 0001_pzo_sovereign_schema.sql   # THE schema — run this
├── run_migration.sh                # Runner with nuke/verify/dry-run
└── README.md                       # This file
```

---

## Sovereign Control Alignment

Per the 7-front doctrine:

| Front | How This Schema Serves It |
|---|---|
| **Economics** | Fixed schema, no metered DB dependencies, cheap storage tiers |
| **Finance** | All money in `_cents BIGINT`, audit trails via event store |
| **Data / Information** | Postgres owns all truth, Redis only for ephemeral state |
| **Manufacturing** | One-command rebuild (`--nuke`), idempotent apply, verify step |
| **Infrastructure** | PgBouncer-safe, replication-ready, BRIN for WAL efficiency |
| **Communications** | Provider events stored in `host_email_events` / `host_webhook_events` |
| **Human Resources** | Named schemas = named ownership domains |
