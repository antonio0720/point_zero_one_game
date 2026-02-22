# Product Intent: Two-Tier Ladder System v1

## Overview

The Two-Tier Ladder System is a design solution for managing competition and cheater drama in Point Zero One Digital's 12-minute financial roguelike game. The system offers two tiers of play: Casual and Verified, catering to both instant and serious competitors.

## Non-Negotiables

1. **Instant vs Serious Competition**: The system allows players to choose between a casual, quick-play mode (Casual) and a more competitive, ranked mode (Verified).
2. **Cheater Drama Mitigation**: The Verified tier ensures a fair playing field by implementing strict verification measures to prevent cheating.
3. **Retention Physics**: The system is designed to encourage player retention through reward structures, progression, and the allure of competition.
4. **Quality of Life (QoL) Guarantees**: The system prioritizes a smooth user experience with clear communication, intuitive interfaces, and minimal friction.
5. **TypeScript Strict-Mode**: All code adheres to strict TypeScript mode for improved type safety and readability.
6. **Deterministic Effects**: All game effects are designed to be deterministic, ensuring fairness and reproducibility.

## Implementation Spec

### Casual Tier
- Players can jump into games instantly without verification.
- No rankings or leaderboards.
- Rewards are primarily cosmetic and do not affect gameplay.

### Verified Tier
- Players must undergo a verification process to ensure fair play.
- Rankings and leaderboards are available for competitive players.
- Rewards can include in-game currency, items, or other advantages that may impact gameplay.

## Edge Cases

1. **Verification Failure**: If a player fails the verification process, they will be restricted to the Casual tier until they pass.
2. **Cheating Detection**: In the event of cheating in the Verified tier, the offending player's account may be suspended or banned, and any ill-gotten gains revoked.
3. **Cross-Tier Interaction**: Players from both tiers can interact, but Verified players will have an advantage due to their rankings and potential rewards.
