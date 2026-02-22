# Sovereign Scoring and Rank System for Pzo Two-Tier Ladder System v1

## Overview

This document outlines the shared scoring foundation, Casual fast-publish with fast-ranked marker, verified proof-backed system with suppression rules, and rank stability policy for the Pzo Two-Tier Ladder System v1.

## Non-Negotiables

1. Strict TypeScript adherence, avoiding 'any' in all code. All code is strict-mode.
2. Deterministic effects across all gameplay elements.
3. Efficient scoring and ranking system for fast-publish and fast-ranked marker functionality.
4. Verified proof-backed system to ensure accuracy and fairness.
5. Suppression rules to handle edge cases and maintain rank stability.
6. Discrete windows policy for rank stability.

## Implementation Spec

### Shared Scoring Foundation

1. Define a scoring function that calculates the final score based on gameplay actions, time spent, and other relevant factors.
2. Ensure the scoring function is deterministic to maintain fairness across all players.
3. Implement a system for storing and retrieving player scores securely.

### Casual Fast-Publish with Fast-Ranked Marker

1. Develop a fast-publish mechanism that allows players to quickly publish their gameplay results.
2. Implement a fast-ranked marker system that updates player rankings in real-time based on the published scores.
3. Ensure the fast-ranked marker system is efficient and scalable to handle high volumes of concurrent players.

### Verified Proof-Backed with Suppression Rules

1. Implement a proof-backing mechanism that verifies each player's score using cryptographic techniques or other methods.
2. Develop suppression rules to handle edge cases, such as cheating or anomalous behavior, and maintain the integrity of the rankings.
3. Ensure the suppression rules are transparent and fair to all players.

### Rank Stability Policy (Discrete Windows)

1. Implement a rank stability policy that groups player scores into discrete windows based on time or other factors.
2. Update player ranks at specific intervals, ensuring rank stability within each window.
3. Allow for occasional rank adjustments outside of the discrete windows in cases of proven cheating or other significant issues.

## Edge Cases

1. Players with identical scores: Implement a tie-breaking mechanism to determine their ranking.
2. Players who are caught cheating: Apply appropriate penalties, such as score deductions or temporary bans, and adjust rankings accordingly.
3. Players who leave the game before scoring: Determine an appropriate default score based on gameplay duration or other factors.
