# Plain English Glossary for Point Zero One Digital Terms

## Overview
This glossary provides clear definitions of key terms used in the context of Point Zero One Digital's projects. The focus is on precise, execution-grade language with an anti-bureaucratic approach.

## Non-negotiables
1. **Determinism**: Refers to a system where every action or outcome can be predicted based on its initial state and rules. In our context, this means that the game's outcomes are consistent across all instances.

2. **Seed**: A unique value used to initialize the random number generator in a deterministic system. This allows for multiple instances of the game to have different but predictable outcomes.

3. **Pinned Content Versions**: Specific versions of content that are locked and cannot be changed. This ensures consistency across all instances of the game.

4. **Authoritative Server Resolution**: The process by which the game resolves conflicts or discrepancies between different instances, deferring to a single trusted source for resolution.

5. **Tamper-Evident Hashing**: A method used to detect if data has been altered. It involves generating a unique hash value for each piece of data and comparing it with a stored reference to check for any changes.

6. **Verification Queue**: A temporary holding area where changes await verification before being applied to the game's state.

7. **Quarantine**: A section of the game isolated from the main system, used to contain potentially harmful or unverified content.

8. **Device Trust Scoring**: A system that assigns a trust score to each device based on its behavior and interaction with the game. This helps in identifying and managing potential threats.

## Implementation Spec
Each term is implemented according to strict TypeScript standards, using strict-mode and avoiding the use of 'any'. All effects are deterministic, ensuring consistent outcomes across all instances.

## Edge Cases
In the case of a conflict between pinned content versions and changes in the verification queue, the pinned content takes precedence. If a device's behavior is deemed suspicious or malicious, its trust score may be reduced, potentially leading to quarantine or other restrictions.
