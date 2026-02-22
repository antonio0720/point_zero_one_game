Founder Artifacts System
==========================

Overview
--------

The Founder Artifacts System is a core component of Point Zero One Digital's Sovereign Infrastructure Architecture in the game "pzo_season0_founding_era_waitlist_engine_v1". This system encompasses three main categories: Founder Titles, Cosmetics, and Proof-Card Stamps. The system is designed to provide a unique experience for early adopters while maintaining a non-grinding gameplay style.

Non-Negotiables
---------------

1. **Deterministic Effects**: All artifacts' effects are predefined and deterministic, ensuring fairness and reproducibility.
2. **Never Earnable Again**: Once an artifact is acquired, it can never be earned again by any player to maintain scarcity and exclusivity.
3. **Strict TypeScript**: All code adheres to strict-mode TypeScript to ensure type safety and consistency.
4. **Artifact Hash Chain**: A secure hash chain is implemented to track the ownership history of each artifact.

Implementation Spec
--------------------

### Founder Titles

Founder Titles are unique titles bestowed upon players who join during the founding era. Each title has a predefined set of benefits, such as increased reputation gain or exclusive access to certain features. Titles are non-transferable and can only be earned once per account.

### Cosmetics

Cosmetics include skins for characters, vehicles, and environments that can be applied to a player's account. These cosmetics are visually distinct and provide no gameplay advantage. Like Founder Titles, cosmetics are non-transferable and can only be earned once per account.

### Proof-Card Stamps

Proof-Card Stamps are unique visual elements that can be added to a player's Proof-Cards. These stamps serve as proof of ownership for certain artifacts or achievements. Like other artifacts, Proof-Card Stamps are non-transferable and can only be earned once per account.

### Evolve-Don't-Grind Ladder

The Founder Artifacts System is designed to encourage exploration and discovery rather than grinding for rewards. Players will have opportunities to acquire artifacts through various means, such as completing challenges or participating in special events. However, the focus is on providing a rich and engaging experience rather than requiring repetitive actions to progress.

Edge Cases
----------

1. **Account Merge**: In the event of an account merge, all artifacts associated with the merged accounts will be consolidated into the primary account. The artifact hash chain will be updated accordingly to reflect the new ownership history.
2. **Artifact Duplication**: If a bug or error results in multiple instances of the same artifact being created, the duplicate artifacts will be automatically destroyed and their ownership history recorded in the artifact hash chain.
3. **Account Deletion**: Upon account deletion, all associated artifacts will be permanently removed from the game and their ownership history will be marked as "deleted" in the artifact hash chain.
