# Two-Tier PvP Ladder Overview

This document outlines the goals, semantics, and UX principles for the two-tier Player versus Player (PvP) ladder system in Point Zero One Digital's financial roguelike game.

## Goals

1. **Trust Firewall**: Ensure fair play by separating casual and verified players, preventing unverified users from competing with verified ones.
2. **Funnel Widening**: Attract and retain a diverse player base by offering two tiers of competition: Casual and Verified, catering to both novice and experienced players.

## Non-Negotiables

1. Strict adherence to TypeScript's strict mode with no usage of 'any'.
2. All effects in the game are deterministic to maintain fairness and reproducibility.
3. Production-grade, deployment-ready infrastructure.

## Implementation Spec

### Casual Tier

1. Open to all players, regardless of verification status.
2. Players can compete for rewards based on their performance within the tier.
3. Matchmaking prioritizes skill level and game progression to ensure balanced matches.
4. Progression through the casual ladder unlocks access to additional content and features.

### Verified Tier

1. Accessible only to verified players.
2. Offers higher stakes, including increased rewards and exclusive content.
3. Matchmaking prioritizes skill level, game progression, and verification status for balanced matches.
4. Progression through the verified ladder unlocks even more premium content and features.

## Edge Cases

1. A player can transition between tiers based on their performance or verification status. For example, a casual player who verifies their account may gain access to the Verified tier.
2. In case of disputes or cheating allegations, an appeals process will be in place to review and potentially reverse decisions made by the system.
