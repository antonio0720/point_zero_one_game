# Public /integrity page spec

## Overview

The `/integrity` page is a crucial component of Point Zero One Digital's financial roguelike game, providing transparency and assurance to players about the game's server-verifiable runs, deterministic replay, and 3-state verification status. This page serves as a testament to our commitment to maintaining production-grade, deployment-ready infrastructure and adherence to strict TypeScript coding standards.

## Non-negotiables

1. **Deterministic Replay**: Every game session must be reproducible with the exact same outcome given the same initial conditions. This ensures fairness and trustworthiness in our game.
2. **Server-Verifiable Runs**: All game sessions are verified by the server to ensure they meet the deterministic replay requirement. This verification process is transparent and accessible to players via the `/integrity` page.
3. **3-State Verification Status**: The `/integrity` page displays the current state of a game session: valid, invalid, or pending verification.
4. **Strict TypeScript Coding Standards**: All code is written in strict mode and never uses 'any'. This ensures type safety and readability in our codebase.

## Implementation Spec

The `/integrity` page retrieves the current state of a game session from the server, verifies it against predefined rules, and displays the result to the player. The page also provides a brief explanation of each verification status:

- **Valid**: The game session has been verified and meets all deterministic replay requirements.
- **Invalid**: The game session has failed verification and is deemed untrustworthy. This could be due to non-deterministic events or errors in the code.
- **Pending Verification**: The server is currently verifying the game session. Once verified, the status will be updated accordingly.

## Edge Cases

In rare cases where a game session cannot be deterministically replayed (e.g., due to network latency or unforeseen circumstances), the `/integrity` page will display an appropriate error message and provide guidance on how to resolve the issue.

## Why This Matters

Transparency and trust are essential in any game, but especially in a financial roguelike where players' investments are at stake. By providing a publicly accessible `/integrity` page, we demonstrate our commitment to maintaining a fair and trustworthy gaming environment for all players. This not only enhances the player experience but also builds long-term credibility for Point Zero One Digital.
