# Run 3 Spec: Mid-Run Macro Regime Twist Proof Pathway (Pending → Verified), Replay-to-Turning-Point, Conversion CTA to Claim Identity (Mac)

## Overview

This spec outlines the process for executing a mid-run macro regime twist in Point Zero One Digital's financial roguelike game on macOS. The goal is to transition from a pending state to a verified state, replay the game up to the turning point, and convert the CTA (Call to Action) to claim identity.

## Non-Negotiables

1. Strict TypeScript adherence: No usage of 'any'. All code is strict-mode.
2. Deterministic effects: All in-game events must produce consistent results given identical inputs.
3. Production-grade, deployment-ready: The solution should be robust and scalable for live gameplay.

## Implementation Spec

1. **Pending State Transition**: Upon meeting specific conditions during the run, trigger a macro regime twist that moves the game state from pending to verified. This transition must be deterministic and based on predefined rules.

2. **Replay Mechanism**: Implement a replay mechanism that allows players to replay the game from the turning point after the macro regime twist. The replay should maintain the same conditions as the original run, ensuring consistent results.

3. **Conversion CTA**: Modify the Call to Action (CTA) to prompt players to claim their identity once they have reached the verified state. This CTA should be displayed at an appropriate point during the game and must not interfere with gameplay.

## Edge Cases

1. **Incomplete Conditions**: If the conditions for the macro regime twist are not met, the game should continue in its current state (pending) without any unexpected behavior or errors.

2. **Replay Interference**: Ensure that the replay mechanism does not interfere with the original run or introduce inconsistencies in the game state.

3. **CTA Visibility**: The CTA for claiming identity should only be displayed once the player has reached the verified state and should not obstruct the user interface or gameplay experience.
