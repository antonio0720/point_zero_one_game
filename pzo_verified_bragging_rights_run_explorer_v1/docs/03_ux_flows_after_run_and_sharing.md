# After-Run UX Loop and Sharing Flow

This document outlines the post-run user experience (UX) loop for a verified run in Point Zero One Digital's 12-minute financial roguelike game, focusing on the minting, verification, and sharing process.

## Overview

Upon successful completion of a run, the player receives a Proof Card that represents their achievement. The card then transitions through various states before reaching final verification and sharing stages.

1. **Proof Card Minted** - The game generates a unique Proof Card for the player's verified run.
2. **Pending** - The Proof Card is temporarily stored in the player's account, awaiting validation by the community.
3. **Get it Stamped** - Other players can review and validate the run, adding their digital signature to the card. Once a sufficient number of signatures are collected, the card moves to the next state.
4. **Verified** - The Proof Card is officially verified by the community, and the player receives a notification.
5. **Celebration** - The player can celebrate their achievement with in-game rewards or visual effects.
6. **Share Sheet** - The player can share their Verified Proof Card on various social media platforms or save it as an image file.

## Non-Negotiables

1. **Deterministic Effects**: All effects, including the minting and verification process, must be deterministic to ensure fairness and reproducibility.
2. **Strict TypeScript**: All code adheres to strict TypeScript mode for improved type safety and readability.
3. **No 'Any'**: The use of 'any' is strictly prohibited in TypeScript to maintain type consistency throughout the codebase.
4. **Production-Grade Deployment**: The system is designed for production-grade deployment, ensuring scalability and reliability.
5. **Governance**: A robust governance system ensures that the verification process remains fair, transparent, and secure.

## Implementation Spec

1. **Proof Card Generation**: Upon a successful run, the game generates a unique Proof Card for the player. The card includes essential information such as the run's details, timestamps, and the player's in-game identity.
2. **Pending State**: The Proof Card is temporarily stored in the player's account, where it can be viewed but not shared or traded until it reaches the Verified state.
3. **Get it Stamped**: Other players can review the run details and choose to validate the Proof Card by adding their digital signature. This process helps build trust within the community and ensures the integrity of the verification system.
4. **Verification**: Once a sufficient number of signatures are collected, the Proof Card is verified, and the player receives a notification. The card then transitions to the Verified state.
5. **Celebration**: Upon verification, the player can celebrate their achievement with in-game rewards or visual effects. This encourages players to strive for better scores and fosters a sense of community competition.
6. **Share Sheet**: Players can share their Verified Proof Cards on various social media platforms or save them as image files. The game provides an intuitive share sheet interface for easy sharing.
7. **Edge Cases**
   - **Insufficient Signatures**: If the Proof Card does not receive enough signatures within a specified timeframe, it will be automatically archived and no longer accessible to the player.
   - **Disputes**: In case of disputes or fraudulent activities, the governance system will intervene to ensure fairness and maintain the integrity of the verification process.
