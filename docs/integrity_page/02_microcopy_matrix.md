# Microcopy for Status Chips

## Overview

This document outlines the microcopy for status chips in Point Zero One Digital's 12-minute financial roguelike game. The status chips include `PENDING`, `VERIFIED`, `QUARANTINED`, and `APPEAL_RESOLVED`. These statuses are displayed across various pages, including After-run, Proof page, Replay page, Leaderboards, and Season hub.

## Non-negotiables

1. Use precise, execution-grade language with zero fluff and anti-bureaucratic tone.
2. All microcopy must be concise and easy to understand for players of all skill levels.
3. The microcopy should provide immediate context about the status of a game or player's actions.

## Implementation Spec

### PENDING

- After-run: "Game results pending verification."
- Proof page: "Proof is currently under review."
- Replay page: "Replay not available until game results are verified."
- Leaderboards: "Pending" displayed next to the player's name.
- Season hub: "Season standings are pending finalization."

### VERIFIED

- After-run: "Game results have been verified."
- Proof page: "Proof has been successfully verified."
- Replay page: "Replay available after game results verification."
- Leaderboards: "Verified" displayed next to the player's name.
- Season hub: "Season standings are finalized."

### QUARANTINED

- After-run: "Game results have been quarantined due to suspicious activity."
- Proof page: "Proof has been quarantined due to suspicious activity."
- Replay page: "Replay not available due to game results quarantine."
- Leaderboards: "Quarantined" displayed next to the player's name.
- Season hub: "Season standings are under review due to suspicious activity."

### APPEAL_RESOLVED

- After-run: "Game results appeal has been resolved."
- Proof page: "Proof appeal has been resolved."
- Replay page: "Replay available after game results appeal resolution."
- Leaderboards: "Appeal Resolved" displayed next to the player's name.
- Season hub: "Season standings have been updated following the appeal resolution."

## Edge Cases

1. If a game is re-verified or re-quarantined, update the microcopy accordingly (e.g., "Game results have been re-verified" or "Game results have been re-quarantined").
2. In case of an appeal being denied, use "Appeal Denied" instead of "APPEAL_RESOLVED".
3. If a player's account is temporarily suspended due to suspicious activity, display "Account Suspended" on the Leaderboards and Season hub.
