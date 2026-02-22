# Proof Objects Glossary

This glossary outlines key player-facing terms in Point Zero One Digital's financial roguelike game. Understanding these concepts is essential for navigating the game's infrastructure and ensuring secure transactions.

## Overview

1. **Run ID**: A unique identifier assigned to each game session. It serves as a reference point for tracking individual runs, verifying proof hashes, and maintaining game history.
2. **Proof Hash**: A cryptographic hash of the game state at the end of a run. This hash is used to verify the integrity of the game data and ensure fairness in transactions.
3. **Verification Status**: The current status of a proof hash during or after a run. Possible values are:
   - **Pending**: The proof hash has been generated but not yet verified by the network.
   - **Verified**: The proof hash has been successfully validated, confirming the integrity of the game state.
   - **Quarantined**: The proof hash is under review due to suspicious activity or inconsistencies in the game data.
4. **Proof Card Variants**: Special items that can be obtained during a run and used to manipulate the game's infrastructure. There are several types of Proof Cards, each with unique effects on the game state.

## Non-negotiables

1. Run IDs are always unique and never reused across different runs.
2. Proof hashes are generated using a deterministic algorithm to ensure consistent results.
3. Verification statuses are updated in real-time as proof hashes are verified or quarantined.
4. Proof Cards have predefined effects that are clearly documented and cannot be altered by players.

## Implementation Spec

1. Run IDs are generated using a combination of the current date, time, and a random seed to ensure uniqueness.
2. Proof hashes are calculated using SHA-256 on the game state data at the end of each run.
3. Verification statuses are stored in a decentralized database that is accessible by all players and network nodes.
4. Proof Cards are represented as non-fungible tokens (NFTs) with predefined metadata describing their effects on the game state.

## Edge Cases

1. In the event of a network outage or other technical issues, proof hashes may not be immediately verified, resulting in pending statuses for extended periods.
2. If suspicious activity is detected during a run (e.g., repeated use of Proof Cards with identical effects), the proof hash may be quarantined until further investigation can be conducted.
3. In rare cases where multiple Run IDs are generated with the same hash value, the older Run ID will take precedence to maintain historical accuracy.
