# Key Metrics, SLOs, and Ops Alert Thresholds for PZO Two-Tier Ladder System v1

## Overview

This document outlines key metrics, Service Level Objectives (SLOs), and operational alert thresholds for the PZO Two-Tier Ladder System v1. The focus is on retention delta, verified adoption, cheating drama indicators, rank update windows, verification completion, and associated ops alerts.

## Non-Negotiables

- Strict adherence to TypeScript's strict mode with zero usage of 'any'.
- All code is deterministic, ensuring fairness and consistency across all game sessions.
- Precise, execution-grade language and anti-bureaucratic approach in documenting metrics and SLOs.

## Implementation Spec

### Key Metrics

1. **Retention Delta**: Measures the difference between the number of active users at a given time period (e.g., daily or weekly) compared to the previous period. A positive value indicates growth, while a negative value suggests a decline in user engagement.

2. **Verified Adoption**: Tracks the percentage of unique users who have completed the game tutorial and engaged in actual gameplay. This metric helps gauge the effectiveness of onboarding processes and player engagement.

3. **Cheating Drama Indicators**: Monitors abnormal behavior patterns that may indicate cheating or exploitation, such as rapid level progression, excessive in-game currency accumulation, or unusual win rates.

### SLOs

1. **Rank Update Windows**: Defines the timeframe within which player rank updates should occur after gameplay sessions. Aim for minimal latency to ensure a smooth and responsive gaming experience.

2. **Verification Completion**: Sets the maximum acceptable time for verifying user actions, such as purchases or level-ups, to maintain a seamless and reliable service.

### Ops Alert Thresholds

1. **Retention Delta**: Trigger an alert if retention delta falls below -5% (daily) or -10% (weekly).
2. **Verified Adoption**: Alert when verified adoption drops below 70%.
3. **Cheating Drama Indicators**: Set up alerts for unusual behavior patterns, such as rapid level progression (more than 5 levels per hour), excessive in-game currency accumulation (more than 1000 coins per day), or unusual win rates (winning more than 80% of games).
4. **Rank Update Windows**: Alert if rank updates take longer than the defined SLO.
5. **Verification Completion**: Trigger an alert if verification completion takes longer than the defined SLO.

## Edge Cases

- Account inactivity for extended periods may affect retention delta and verified adoption metrics, requiring adjustments to account for dormant accounts.
- Cheating drama indicators may be influenced by game design elements or player strategies that are intended but appear exploitative. In such cases, it's essential to differentiate between legitimate playstyles and actual cheating.
