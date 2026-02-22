# PVP Ladders Metrics, SLOs, and SLIs for Rank Update Windows and Verification Completion

## Overview

This document outlines the metrics, Service Level Objectives (SLOs), and Service Level Indicators (SLIs) for PVP ladders rank update windows and verification completion in Point Zero One Digital's 12-minute financial roguelike game. The focus is on retention delta, verified adoption, and cheating drama indicators to ensure a fair and engaging gaming experience.

## Non-negotiables

1. **Deterministic Execution**: All calculations must be deterministic to maintain consistency across all players and servers.
2. **Strict TypeScript**: Adherence to strict TypeScript mode is mandatory for all code related to these metrics, SLOs, and SLIs.
3. **No 'Any' Type**: The use of the 'any' type is strictly prohibited in TypeScript to maintain type safety and readability.
4. **Production-Grade**: All solutions must be production-ready and deployment-ready.

## Implementation Spec

### Metrics

#### Retention Delta

Retention delta measures the difference between the percentage of active players (players who have played within a specific timeframe) in consecutive periods. A positive retention delta indicates player growth, while a negative one suggests a decline.

```markdown
Retention Delta = (Active Players in Period 2 - Active Players in Period 1) / Active Players in Period 1
```

#### Verified Adoption

Verified adoption measures the percentage of players who have completed the verification process, ensuring they are playing under fair conditions.

```markdown
Verified Adoption = (Number of Verified Players) / (Total Number of Players)
```

#### Cheating Drama Indicators

Cheating drama indicators help identify and address instances of cheating within the game, ensuring a fair and enjoyable experience for all players. Potential indicators include:

1. **Suspicious Transactions**: Unusual or abnormal transactions that deviate from typical player behavior.
2. **Winning Streaks**: Long winning streaks that are statistically improbable.
3. **Account Age**: New accounts with an unusually high rank or wealth.
4. **Concurrent Sessions**: Multiple sessions originating from the same IP address or device.

### SLOs and SLIs for Rank Update Windows and Verification Completion

#### Retention Delta SLO

- Target: 0.8 (80%)
- Error Margin: ±0.1 (10%)
- Timeframe: Monthly

#### Verified Adoption SLO

- Target: 0.95 (95%)
- Error Margin: ±0.02 (2%)
- Timeframe: Daily

#### Cheating Drama Indicators SLI

- Suspicious Transactions: Maximum of 1% of total transactions per day.
- Winning Streaks: Maximum of 5 consecutive wins per player per week.
- Account Age: New accounts with a rank or wealth above the 99th percentile should be flagged for review.
- Concurrent Sessions: More than 3 concurrent sessions from the same IP address or device should trigger an alert.

## Edge Cases

1. **Retention Delta**: If the number of active players in a period is zero, the retention delta will be undefined. In such cases, consider using a small positive value (e.g., 0.001) as a proxy.
2. **Verified Adoption**: If the total number of players is zero, the verified adoption will also be undefined. In such cases, consider using a default value (e.g., 0) as a proxy.
3. **Cheating Drama Indicators**: These indicators should be used in conjunction with other data and human review to ensure accurate identification of potential cheaters.
