# Proof Card Stamps and Receipts

This document outlines the design and implementation of proof card stamps and receipts for Point Zero One Digital's 12-minute financial roguelike game, Sovereign Infrastructure Architect.

## Overview

Proof card stamps and receipts serve as digital credentials that verify a player's participation in the founding era of the game. These credentials can be used to unlock exclusive content, incentivize virality, and provide a sense of achievement for players.

## Non-negotiables

1. **Deterministic**: All effects related to proof card stamps and receipts must be deterministic to ensure fairness and reproducibility.
2. **Strict TypeScript**: All code related to proof card stamps and receipts should adhere to strict TypeScript, avoiding the use of 'any'.
3. **Production-grade**: The implementation must be production-ready, ensuring scalability and reliability.
4. **Deployment-ready**: The system should be easily deployable across various platforms and environments.
5. **User Experience (UX) Rules**
   - Visible: Proof card stamps and receipts should be easily accessible and visible to players.
   - Not Noisy: The presentation of proof card stamps and receipts should not clutter the user interface or distract from gameplay.

## Implementation Spec

### Stamp Fields

Each proof card will have a unique identifier, timestamp, and a stamp field for verification. The stamp field will contain a hash that corresponds to a specific event or achievement within the game.

### Verification Compatibility (Verified + Stamp = Sport Mode Credential)

When a player's proof card is verified by a game official (Verified), and a stamp is added to the card (Stamp), it will create a sport mode credential. This credential can be used to unlock exclusive content or incentives within the game.

### Virality Rationale

Players with sport mode credentials can share them with friends, encouraging virality. When a new player uses a shared sport mode credential to verify their proof card, both players receive a reward, fostering a sense of community and competition.
