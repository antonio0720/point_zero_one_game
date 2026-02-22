# Point Zero One Digital - 3-Tier Enforcement, Fast Ruling Script, Host Cheats, Role Descriptions, and Dispute Resolution

## Overview

This document outlines the rules for the game Point Zero One Digital, focusing on the 3-tier enforcement system, Fast Ruling script, host cheats, role descriptions, and dispute resolution.

## Non-Negotiables

1. Strict TypeScript: Never use 'any'. All code is strict-mode.
2. Deterministic effects: All game outcomes are predictable and reproducible.
3. 3-Tier Enforcement: Rules are enforced at three levels: always, when it matters, and ignore.
4. Fast Ruling Script: A script that makes decisions in no more than three lines of code.
5. Host Cheats: Limited cheat options for testing and debugging purposes.
6. Role Descriptions: Each player has a specific role with unique responsibilities.
7. Dispute Resolution: Procedures to handle disagreements between players or the system.

## Implementation Spec

### 3-Tier Enforcement

1. **Always**: Rules that are enforced at all times, regardless of game state or context.
2. **When It Matters**: Rules that only apply under specific conditions or during certain phases of the game.
3. **Ignore**: Rules that can be temporarily disregarded for testing or debugging purposes.

### Fast Ruling Script

```typescript
function fastRuling(input: any, context: any): boolean | number | string {
  // Implement decision-making logic in no more than three lines of code.
}
```

### Host Cheats

Hosts can enable cheat modes for testing and debugging purposes. The available cheats may include:

1. God Mode: Invincibility, unlimited resources, etc.
2. Time Manipulation: Pause, rewind, or fast-forward the game.
3. Resource Hack: Instant access to any resource.

### Role Descriptions

#### Timer

Responsible for managing the game clock and ensuring that each round progresses according to schedule.

#### Dealer

Deals cards, manages resources, and enforces rules related to game assets.

#### Clipper

Monitors player actions and enforces rules related to interactions between players.

#### Scorekeeper

Tracks scores, determines winners, and announces results at the end of each round.

### Dispute Resolution

In case of disagreements between players or the system, a dispute resolution process is initiated:

1. Players submit their arguments in writing.
2. The dispute is reviewed by an impartial third party (e.g., another player or an automated system).
3. The third party makes a decision based on the rules and evidence provided.
4. The decision is communicated to all parties involved, and it is final.
