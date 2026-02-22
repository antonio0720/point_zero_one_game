# Point Zero One — Card Catalog v2.0 Upgrade Summary
**Author:** Antonio T. Smith Jr. × RA-OMEGA  
**Status:** PRODUCTION-READY  
**Generated:** 2025 | Repo: `pzo_engine/src/cards/`

---

## WHAT CHANGED

### The Core Upgrade
The old system had econ blocks (numbers) but **zero engine wiring** — cards couldn't actually do anything. Every card now has a fully realized `effects[]` array that executes through `applyCard.js` with zero friction.

---

## FINAL DECK COUNTS

| Deck | Count | Color | Role |
|------|-------|-------|------|
| **OPPORTUNITY** | 148 | 🟢 Green | Real estate, businesses, partnerships |
| **SO** (Systemic Obstacle) | 50 | ⚫ Black | Loan denials, forced sales, rate penalties |
| **FUBAR** | 60 | 🔴 Red | Lifestyle expenses that drain cash |
| **PRIVILEGED** | 44 | 🥇 Gold | Shields, cash grants, deal access |
| **MISSED_OPPORTUNITY** | 33 | 🟠 Orange | Inertia tax — punishes hesitation |
| **IPA** | 28 | 🔵 Blue | Income-producing assets (no debt) |
| **TOTAL** | **363** | | |

---

## EFFECTS ENGINE WIRING

Every card maps to real engine ops from `applyCard.js` / `ops.js`:

### OPPORTUNITY Cards → 2-step buy flow
```json
[
  { "op": "PROMPT_BUY_OR_PASS" },
  { "op": "ON_BUY_ADD_ASSET", "asset": {
    "name": "8-plex for Sale",
    "kind": "REAL_ESTATE",
    "cost": 220000,
    "debt": 180000,
    "cashflowMonthly": 1700
  }}
]
```

### IPA Cards → Build an income stream
```json
[
  { "op": "PROMPT_BUY_OR_PASS_IPA" },
  { "op": "ON_BUY_ADD_IPA", "asset": {
    "name": "Notary Signing Side-Hustle Kit",
    "cost": 600,
    "cashflowMonthly": 1260
  }}
]
```

### FUBAR Cards → Immediate cash hit
```json
[{ "op": "CASH_ADD", "amount": -2000 }]
```

### SO Cards → 4 distinct threat types
```json
// LOAN_DENIAL (6 cards)
[{ "op": "BUFF_ADD", "buff": { "type": "LEVERAGE_BLOCK", "uses": 1 }}]

// FORCED_SALE (1 card — the most feared card in the game)
[{ "op": "PROMPT_FORCED_SALE" }]

// TURNS (11 cards)
[{ "op": "TURNS_SKIP", "count": 3 }]

// FEE (32 cards — cash drain)
[{ "op": "CASH_ADD", "amount": -2500 }]
```

### MISSED_OPPORTUNITY Cards → Inertia Tax
```json
// 9 cards — REVEAL the next deal to the whole table if you hesitate
[
  { "op": "CASH_ADD", "amount": -500 },
  { "op": "NEXT_OPPORTUNITY_OPEN_TO_TABLE" }
]
```

### PRIVILEGED Cards → 3 buff types
```json
// Shield (absorbs next FUBAR or SO)
[{ "op": "BUFF_ADD", "buff": { "type": "SHIELD", "uses": 1, "cancels": ["FUBAR","SO"] }}]

// Downpay Credit
[{ "op": "BUFF_ADD", "buff": { "type": "DOWNPAY_CREDIT", "uses": 1, "amount": 15000 }}]

// Draw Opportunity cards
[{ "op": "DRAW_OPPORTUNITY_PICK_BEST", "count": 3 }]

// Cash grant
[{ "op": "CASH_ADD", "amount": 25000 }]
```

---

## POWER RANKINGS

### Top OPPORTUNITY Cards (ROI)
| Card | ROI | Monthly CF | Down Payment |
|------|-----|------------|--------------|
| Roofing Company (Insured) | 254% | +$7,400 | $35,000 |
| Laundry Route (6 Locations) | 190% | +$8,700 | $55,000 |
| Pest Control Route | 165% | +$10,300 | $75,000 |
| Automated Business — Coin Car Wash | 86% | +$1,800 | $25,000 |
| Pizza Franchise | 60% | +$5,000 | $100,000 |

### Top IPA Cards (ROI — no debt required)
| Card | ROI | Monthly CF | Setup Cost |
|------|-----|------------|------------|
| Notary Signing Side-Hustle Kit | 2,520% | +$1,260 | $600 |
| Résumé Writing Service | 1,320% | +$440 | $400 |
| Micro-SaaS Widget | 1,224% | +$1,020 | $1,000 |
| Tutoring Network | 1,131% | +$660 | $700 |
| Tax Prep Side-Hustle Kit | 1,120% | +$1,400 | $1,500 |

### Most Dangerous SO Cards
| Card | Threat | Effect |
|------|--------|--------|
| Asset Seizure Threat | ⚠️⚠️⚠️ CRITICAL | Forced sale at 70% — you can lose cash AND the asset |
| Credit Line Frozen | ⚠️⚠️ HIGH | Next purchase must be all-cash |
| Licensing Backlog | ⚠️⚠️ HIGH | 3 turns lost |

---

## MISSED_OPPORTUNITY — Viral Mechanic

**The REVEAL mechanic** is the most psychologically powerful feature in the deck. 9 of the 33 MISSED_OPPORTUNITY cards activate `NEXT_OPPORTUNITY_OPEN_TO_TABLE` — meaning when YOU hesitate, the table can see the deal you're passing on and anyone can buy it.

This creates real social pressure, live drama, and content moments every game. Watch players agonize in public.

The 33 titles are each distinct psychological archetypes of financial hesitation:
- "You Said 'I'm Not an Investor'" (-$3,000)
- "Critics Aren't Cashflow" (-$2,500, -1 turn)
- "You Waited for the Market to Recover" (-$3,000)
- "You Watched Instead of Played" (-$3,500)
- "Fear Is a Liar; ROI Is Math" (-$1,500)

---

## FILES DELIVERED

| File | Contents |
|------|----------|
| `catalog.json` | All 363 cards with full effects[], econ, tags |
| `decks.json` | Cards grouped by deck type for shuffle engine |
| `ids.json` | Stable deterministic IDs for persistence layer |

### Deploy to Repo
```bash
# These 3 files go in:
pzo_engine/src/cards/catalog.json
pzo_engine/src/cards/decks.json
pzo_engine/src/cards/ids.json
```

The `compile_printable_cards_to_catalog.ts` compiler script at `tools/pzo_cards/` can regenerate from the printable MD if you update card text. The `effects[]` logic is in `build_catalog_v2.py` / `upgrade_catalog.py`.

---

## VALIDATION RESULTS

```
✅ 363 cards total
✅ 0 cards missing effects[]
✅ 0 duplicate IDs
✅ 0 OPPORTUNITY ROI calculation mismatches
✅ All 6 deck types populated
✅ MISSED_OPPORTUNITY: 33 distinct titles (was 6 repeated)
✅ Shield + Forced Sale + Loan Denial wired to engine buffs
✅ 9 MISSED cards trigger NEXT_OPPORTUNITY_OPEN_TO_TABLE (viral mechanic)
```

---

*Built by RA-OMEGA. Every card is deployable. Zero fluff.*
