# Sovereign Economy Pipeline: Season Placement and Revenue Share Rules

## Overview

This document outlines the rules for season placement and revenue share in Point Zero One Digital's financial roguelike game, focusing on the placement pool rules, ranking algorithm, verified-only revenue share, and anti-fraud clawback process.

## Non-negotiables

1. **Deterministic Placement Pool**: The placement pool is designed to be deterministic, ensuring fairness and transparency in the distribution of rewards.
2. **Ranking Algorithm**: The ranking algorithm prioritizes retention, completion, replay value, shareability, novelty, and penalizes fraudulent activities.
3. **Verified-Only Revenue Share**: Only verified users are eligible for revenue share based on their seasonal performance.
4. **Anti-Fraud Clawback Process**: A robust process is in place to detect and recover funds from fraudulent activities.

## Implementation Spec

### Placement Pool Rules

The placement pool is a predefined, fixed amount of rewards distributed among the top-performing players at the end of each season. The distribution is based on the ranking algorithm's evaluation of each player's performance.

### Ranking Algorithm

1. **Retention**: Players who maintain an active presence throughout the season receive higher rankings.
2. **Completion**: Completing more levels or achieving specific milestones within the game increases a player's ranking.
3. **Replay Value**: Players who replay levels multiple times, contributing to the game's longevity, receive higher rankings.
4. **Shareability**: Players whose content (e.g., streams, videos) encourages others to play the game receive higher rankings.
5. **Novelty**: Innovative strategies or unique approaches to gameplay can boost a player's ranking.
6. **Fraud-Penalty**: Any detected fraudulent activities (e.g., bot usage, account sharing) will result in penalties, including reduced rankings and potential exclusion from the revenue share.

### Verified-Only Revenue Share

To be eligible for revenue share, users must pass a verification process to ensure they are genuine players and not bots or multiple accounts controlled by a single entity.

### Anti-Fraud Clawback Process

1. **Detection**: The system continuously monitors user activity for signs of fraudulent behavior.
2. **Investigation**: Suspected cases are investigated, often involving manual review and analysis.
3. **Recovery**: If fraud is confirmed, the recovered funds will be redistributed among eligible players based on their rankings.

## Edge Cases

1. **Account Sharing**: In cases where multiple people share an account, the primary user (as determined by account activity) will receive the revenue share and placement rewards.
2. **Bot Detection**: The system uses a combination of machine learning algorithms and manual review to detect bots. False positives may occur, and users should appeal any incorrect determinations.
3. **Account Verification**: Users who are unable to verify their accounts due to platform limitations or other issues will not be eligible for revenue share but may still participate in the game and compete for placement rewards.
