# PZO Taskbook Automation Pack — v1.2

**Generated:** 2026-02-19 21:00:00Z  
**Taskbook (full):** `master_taskbook_PZO_AUTOMATION_v1_2.ndjson`  
**Taskbook (patch-only):** `master_taskbook_PZO_AUTOMATION_v1_2_patch_only.ndjson`  
**Model:** `master_taskbook_COMPLETE.ndjson` (schema-compatible)

## Source of truth
- Build guide: `PZO_Master_Build_Guide.docx`
- Supporting specs: mechanics (M01–M150), ML companions (M01a–M150a), backend/frontend trees, card references

## What changed from v1.1 → v1.2 (new additions only)
This sweep adds four execution-critical layers implied by the build guide but not fully locked into the taskbook previously:

1) **Canonical thresholds + drift locks**
- Adds a single canonical constants module + tests so bankruptcy / forced-sale math can’t silently diverge.

2) **Ruleset versioning in proofs + ML audits**
- Adds `ruleset_version` and wires it into the proof hash and Tier-1 ML audit hashes, matching the guide’s integrity law.

3) **True “hands-off” automation gates**
- Adds a safe shell adapter + a preflight script + runner session-guard hooks so baseline checks and DoD checks become automatable.

4) **UI stack parity**
- Adds Tailwind + Vite alias wiring to match the Phase 3 stack described in the guide.

## Totals
- **Total tasks:** 450
- **New tasks added in v1.2:** 20

## Quickstart (recommended order)
1. Run **PZO_P00_TASKBOOK_AUTOMATION** tasks first (import/unpack/compile/validate/runner hardening).
2. Run **Phase 1** tasks (engine upgrade).
3. Run **Phase 2** tasks (persistence + proofs).
4. Run **Phase 3** tasks (browser UI).
5. Run **Phase 4** tasks (multiplayer).
6. Run **Phase 5** tasks (ML + monetization).

## New patch tasks included (v1.2)
(See `master_taskbook_PZO_AUTOMATION_v1_2_patch_only.ndjson` for exact lines.)
- PZO_T00431 … PZO_T00450

