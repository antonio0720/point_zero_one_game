# Proof and Stamp System

## Overview

The Proof and Stamp System is a crucial component of PZO Digital's verification process. It ensures the integrity, reproducibility, and authenticity of game runs in `pzo_verified_bragging_rights_run_explorer_v1`.

## Non-negotiables

1. **Proof Hash**: A unique hash generated for each game run that can be used to verify the integrity of the run data.
2. **Run ID**: A unique identifier for each game run, used in conjunction with the Proof Hash for verification purposes.
3. **3-state Verification Status**: The system maintains three states: `draft`, `pending`, and `stamped`. Each proof card transitions through these states during the verification process.
4. **Draft vs Stamped Proof Card variants**: Draft proof cards are unverified, while stamped proof cards have been verified by the system.
5. **'Don't post it until it's stamped' policy**: All game runs must be verified before they can be publicly displayed or shared.

## Implementation Spec

### Proof Hash Generation

The Proof Hash is generated using a cryptographic hash function (SHA-256) on the serialized game run data. The resulting hash is base64 encoded for easier handling and display.

### Run ID Assignment

Run IDs are auto-generated sequentially for each game run, ensuring uniqueness and orderliness.

### Verification States

#### Draft

Upon completion of a game run, the proof card is initially in the `draft` state. This indicates that the run data has been recorded but not yet verified.

#### Pending

When a moderator initiates the verification process, the proof card transitions to the `pending` state. During this phase, the system checks the Proof Hash and Run ID against the game's internal records.

#### Stamped

If the verification is successful, the proof card is marked as `stamped`, signifying that the run has been officially recognized and can be shared publicly. If the verification fails, the proof card remains in the `pending` state, and the moderator may request additional information or initiate a manual review.

## Edge Cases

1. **Duplicate Runs**: In case of duplicate runs (same Proof Hash and Run ID), the system will only recognize the first occurrence as valid. Subsequent duplicates will be ignored.
2. **Malicious Actors**: The system is designed to withstand attempts at manipulation by malicious actors, such as tampering with game data or attempting to submit multiple proof cards for the same run.
3. **Offline Verification**: In rare cases where the system is temporarily unavailable, moderators can manually verify runs using offline tools and then update the system once it's back online.
