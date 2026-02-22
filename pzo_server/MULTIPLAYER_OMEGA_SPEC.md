# POINT ZERO ONE — MULTIPLAYER OMEGA SPEC
## Sovereign Social Infrastructure v2.0
### Inspired by: Game of War, Mobile Strike, War Commander

---

## ARCHITECTURE SUMMARY

```
GLOBAL CHAT          → All players, all servers. Rate: 1 msg/3s.
SERVER CHAT          → Players on same server/region. Rate: 1 msg/3s.
ALLIANCE CHAT        → Members only. Rate: 1 msg/1s.
ALLIANCE OFFICER     → R3+ only. Rate: 1 msg/1s.
PRIVATE ROOM         → Up to 10 players. Invite-only option.
DM (Direct Message)  → 1:1. Rate: 1 msg/0.5s.
```

---

## RANK SYSTEM (R1–R5)

| Rank | Title           | Unlock Conditions         |
|------|-----------------|---------------------------|
| R5   | Sovereign       | Alliance founder or transferred from previous R5 |
| R4   | Commander       | Promoted by R5            |
| R3   | Officer         | Promoted by R5 or R4      |
| R2   | Soldier         | Promoted by R4+            |
| R1   | Recruit         | Default on join           |

### Permission Matrix

| Action                      | R1 | R2 | R3 | R4 | R5 |
|-----------------------------|----|----|----|----|----|
| Chat (all alliance channels) | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Roster                 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Receive Aid                 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send Aid                    | ❌ | ✅ | ✅ | ✅ | ✅ |
| Vote                        | ❌ | ✅ | ✅ | ✅ | ✅ |
| Participate in Wars         | ❌ | ✅ | ✅ | ✅ | ✅ |
| Moderate Chat               | ❌ | ❌ | ✅ | ✅ | ✅ |
| Pin Messages                | ❌ | ❌ | ✅ | ✅ | ✅ |
| Lock Channel                | ❌ | ❌ | ✅ | ✅ | ✅ |
| Kick R1/R2                  | ❌ | ❌ | ❌ | ✅ | ✅ |
| Kick R3                     | ❌ | ❌ | ❌ | ✅ | ✅ |
| Accept Applications         | ❌ | ❌ | ❌ | ✅ | ✅ |
| Access Vault                | ❌ | ❌ | ❌ | ✅ | ✅ |
| Declare War (pending)       | ❌ | ❌ | ❌ | ✅ | ✅ |
| Declare War (execute)       | ❌ | ❌ | ❌ | ❌ | ✅ |
| Rename Alliance             | ❌ | ❌ | ❌ | ❌ | ✅ |
| Disband Alliance            | ❌ | ❌ | ❌ | ❌ | ✅ |
| Set Tax Rate                | ❌ | ❌ | ❌ | ❌ | ✅ |
| Transfer Leadership         | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## CHAT SYSTEM SPEC

### Channel Types
```
1. GLOBAL       — visible to all, moderated heavily, war alerts broadcast here
2. SERVER       — players on same shard, local meta discussions
3. ALLIANCE     — all members, no outsiders see this
4. OFFICER      — R3+, strategy/moderation discussions
5. ROOM         — up to 10 players, invite code, named by creator
6. DM           — 1:1, fully private, unsend available
```

### Message Types
```
TEXT        — standard message, 500 char max, sanitized
STICKER     — from sticker library (12 PZO-themed)
SYSTEM      — auto-generated (join/leave/rank change events)
WAR_ALERT   — red, bold broadcast when war declared
DEAL_INVITE — inline card to invite someone to a deal/run
PROOF_SHARE — shareable run proof with hash
```

### Key Features

**Unsend (15-second window)**
- Available in: TEXT messages, any channel
- Disabled in: WAR ROOM (immutable record during war)
- Client behavior: bubble shows "[message unsent]" in italic gray
- Server behavior: body wiped, status → UNSENT, broadcast to all channel clients

**Block**
- Silent block: blocked user doesn't know
- Bidirectional: if A blocks B, neither sees the other's messages
- Available via: right-click/long-press context menu on any message
- Block list accessible in: Profile → Privacy → Block List

**Reply/Thread**
- Inline reply shows sender name + preview of original
- Supports sticker replies
- No infinite nesting — single-level threading only

**Reactions**
- 6 emoji reactions: 👑 💰 🔥 💀 ✅ ❌
- Toggle: tap same emoji to unreact
- Count shows up to first 3 reactors by name

**Pinned Message**
- R3+ can pin 1 message per channel
- Shows as banner at top of chat panel
- Clicking scrolls to original message

**Slow Mode**
- R3+ can set slow mode: off / 5s / 15s / 30s / 60s
- Applies to R1/R2 only — officers exempt

**Channel Lock**
- R3+ can lock: only R3+ can send while locked
- Use case: war prep silence, announcement mode

### Moderation
```
Actions available to R3+:
- Delete message (leaves "[message removed]" placeholder)
- Kick from room (ROOM channels only)
- Report to mod queue

Actions available to platform moderators:
- Chat mute (duration: 1h, 24h, 7d, permanent)
- Quarantine (can play but excluded from leaderboards)
- Account ban
- Device ban
```

---

## ALLIANCE SYSTEM SPEC

### Alliance Lifecycle
```
CREATE → Set tag (2-6 chars, unique), name, description, banner, open/closed
JOIN   → Direct (open) or Apply (closed) → R4+ accepts
LEVEL  → Gains XP from: war wins, member contributions, run completions
EXPAND → Purchase capacity: 25 → 50 → 100 → 250 (IAP)
DISBAND → R5 only, last resort, 48h confirmation delay
```

### Alliance Banner
- Primary + secondary color (hex picker)
- Icon from set of 20 (crown, sword, dollar, fire, shield, etc.)
- Banner shows in chat, leaderboards, war declarations

### Alliance Tag Rules
- 2–6 characters, uppercase alphanumeric only
- Globally unique, permanent after creation
- Tag appears in chat as [TAG] prefix beside member names

### Join Cooldown
- 24 hours after leaving or being kicked from any alliance
- Cannot apply to multiple alliances simultaneously
- Pending applications: max 3 open at once per player

### Alliance Aid
- R1+ can request: COINS, BOOST, SHIELD
- R2+ can fulfill requests
- R3+ approves aid delivery
- Aid expires in 8 hours
- Daily contribution cap per player: 100,000 coins to vault

### Alliance Vault
- Shared coin pool contributed by members
- R4+ can access/spend from vault
- Spend categories: War boosts, Alliance shop, Capacity expansion
- Contribution tracked per member, shows on roster

### Alliance Tax Rate (set by R5)
- 0%–10% tax on members' run cashflow goes to vault
- Visible to all members
- Changing tax rate requires 24h notice announcement

---

## ALLIANCE WAR SYSTEM

### War Phases
```
DECLARED      → R5 declares war on target alliance, 2h notice
PREPARATION   → 2h window, both alliances prep boosts + strategy
ACTIVE        → 24h war window, members earn war points by:
                 • Completing runs (base points)
                 • Using war boosts (multiplier)
                 • Hitting specific card combos (bonus points)
SETTLEMENT    → 1h cooldown, final tallies, plunder calculated
ENDED         → Outcome recorded, proof hash generated, replay available
```

### War Points
- R2+ can participate
- Points earned per run completed during active war
- Multipliers from war boosts (purchasable from vault)
- War Room (private chat) created for duration — unsend disabled

### War Outcome
- Winner = more war points after 24h
- Plunder: winning alliance takes 5% of losing alliance's vault
- War record tracked: W/L/T, visible on alliance profile
- Alliance XP granted regardless of outcome (participation XP)

### War Shield
- Active War Shield: cannot be declared upon for 24h after war ends
- R5 can purchase extended shield (IAP)
- Max shield duration: 7 days purchased

---

## SOCIAL FEATURES

### Friend System
```
Send Request → Accept/Decline → Friends list
Mutual friends: see online status, recent run results
Friend leaderboard: separate rankings among friends
DM unlocked automatically between friends
```

### Player Profile (social-facing)
```
Display name + avatar
Alliance tag + rank badge
Player title (earned, displayed if unlocked)
Net worth (last 30 days)
Win rate, runs completed
Ghost Run record vs others
Recent run proof hashes
```

### Player Titles (earned, not purchased)
```
THE_SOVEREIGN    — Hold R5 for 30 consecutive days
THE_ARCHITECT    — Complete 100 runs with positive cashflow
FUBAR_PROOF      — Survive 20 FUBAR cards without going negative
THE_CLOSER       — Win 10 co-op contracts in a single season
VAULT_LORD       — Contribute 1M coins to alliance vault
WAR_GENERAL      — Win 5 alliance wars as R5
UNTOUCHABLE      — 30-day run streak without FUBAR hit
```

### Report System
```
Categories: SPAM | HARASSMENT | CHEATING | EXPLOITATION | HATE_SPEECH | OTHER
Flow: Report → Mod Queue → Review → Action (warn/mute/quarantine/ban)
Reporters notified of outcomes
False report tracking to discourage abuse
```

---

## PRESENCE SYSTEM

```
● Green   = Online (active session < 5min ago)
◐ Yellow  = Away (session 5–30min ago)
○ Gray    = Offline (no active session)
```

- Alliance roster sorted by: Rank → Online status → War Points
- Global/Server chat shows presence pip next to name
- DM shows "last seen [time]" when offline

---

## NOTIFICATIONS

### Push Notifications (opt-in per category)
```
- Alliance war declared
- Alliance war ending in 1h
- You were promoted/demoted
- Alliance application accepted
- Aid request fulfilled
- DM received (from friends only, default on)
- Friend completed a run (weekly digest)
- Global/server: never (too noisy)
```

### In-Game Notification Bell
```
All notification categories: always on
Categories toggle in Profile → Notifications
```

---

## IAP INTEGRATION (chat/social layer)

| Product              | Price  | Contents |
|----------------------|--------|----------|
| Sticker Pack: Wealth | $1.99  | 6 premium animated stickers |
| Alliance Name Change | $2.99  | One-time alliance rename token |
| Alliance Expansion   | $14.99 | Capacity 25→50 (permanent) |
| Alliance Expansion   | $24.99 | Capacity 50→100 (permanent) |
| War Chest            | $24.99 | 50k coins + 5 war boosts + shield |
| Extended Shield      | $9.99  | 7-day war shield |
| Sovereign Pack       | $99.99 | 250k coins + R5 title token (1 season) + War Boost x3 |
| Season Pass          | $9.99/mo | Monthly coins + exclusive sticker + double XP |

---

## DEPLOYMENT FILE MAP

```
pzo_server/src/services/chat/
├── ChatService.ts              ← BUILT ✅
├── ChatRouter.ts               ← Wire HTTP + WS endpoints
└── ChatMiddleware.ts           ← Auth + rate limit middleware

pzo_server/src/services/alliance/
├── AllianceService.ts          ← BUILT ✅
├── AllianceRouter.ts           ← REST endpoints
└── AllianceWarService.ts       ← War phase state machine

pzo_client/src/components/chat/
├── SovereignChat.tsx           ← BUILT ✅ (Game of War UI)
├── AlliancePanel.tsx           ← Roster, ranks, vault, applications
└── RoomManager.tsx             ← Create/join/manage private rooms

migrations/
└── 0010_multiplayer_sovereignty.sql  ← BUILT ✅ Full schema

shared/contracts/multiplayer/
└── index.ts                    ← BUILT ✅ (previous session)
```

---

## PHASE DELIVERY TIMELINE

**Phase 1 — Weeks 1–4: Chat + Alliance Foundation**
- Alliance CRUD, R1–R5 ranks, permissions
- Alliance chat + Officer chat
- DM + Block + Unsend
- Friend system

**Phase 2 — Weeks 5–8: Social Depth**
- Global + Server chat
- Private rooms (Household Table + Rivalry Room)
- Presence system
- Report queue + moderation tools
- Alliance Aid system
- Leaderboards (global + alliance + friends)

**Phase 3 — Weeks 9–14: War Engine**
- War declaration + phase state machine
- War Room (chat with unsend disabled)
- War Points system
- War boosts + plunder
- War history + proof hashes
- Alliance Shield system

**Phase 4 — Weeks 15–20: Monetization Polish**
- IAP store integration
- Sticker packs (animated)
- Player title system
- Alliance banner customization
- Season pass infrastructure
- Push notification system
- Analytics dashboard for LTV + social funnel

---

## VIRALITY MECHANICS BUILT IN

1. **Deal Invite** — send a DEAL_INVITE message; recipient clicks → instantly joins your co-op run
2. **Proof Share** — share run result as chat card with hash → anyone can verify it's real
3. **War Alert Broadcast** — war declarations push to global chat with both alliance banners → creates hype
4. **Title Flexing** — player titles visible in every message → social status signal
5. **Missed Opportunity Reveal** — game mechanic broadcasts to ROOM chat when triggered → creates content moments
6. **Rank Promotion Announcements** — auto system message when R4 promotes someone → celebration culture
