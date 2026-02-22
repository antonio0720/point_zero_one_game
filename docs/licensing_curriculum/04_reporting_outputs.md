# Institutional Reporting Pack for Point Zero One Digital's 12-minute Financial Roguelike Game

## Overview

This document outlines the Institutional Reporting Pack (IRP) for our 12-minute financial roguelike game. The IRP includes survival rates, failure modes, improvement deltas, risk signatures, export formats (PDF/CSV), and safe aggregation rules.

## Non-Negotiables

1. **Deterministic Results**: All effects in the game are deterministic to ensure consistent reporting across all instances.
2. **Strict TypeScript**: All code adheres to strict TypeScript mode for error prevention and type safety.
3. **No 'Any'**: The use of 'any' is strictly prohibited in TypeScript to maintain type consistency.
4. **Production-Grade**: The reporting system is designed for production-grade deployment, ensuring reliability and scalability.
5. **Deployment-Ready**: The system is ready for immediate deployment without requiring additional setup or configuration.

## Implementation Spec

### Survival Rates

Survival rates are calculated as the percentage of games where the player successfully completes the game within the 12-minute time limit.

```markdown
Survival Rate = (Number of successful games) / (Total number of games played) * 100%
```

### Failure Modes

Failure modes are categorized based on the reasons for game termination, such as running out of time, resources, or encountering an insurmountable obstacle.

### Improvement Deltas

Improvement deltas measure the change in survival rates over a specified period, providing insights into the effectiveness of game updates and player strategies.

```markdown
Improvement Delta = (New Survival Rate - Old Survival Rate) * 100%
```

### Risk Signatures

Risk signatures identify patterns or factors that increase the likelihood of failure, helping to inform game balancing and player strategy recommendations.

### Export Formats

The IRP supports both PDF and CSV export formats for easy data analysis and sharing.

### Safe Aggregation Rules

When aggregating data from multiple sources, the system follows strict rules to ensure accurate and consistent results:

1. **Time-Based Aggregation**: Data is aggregated based on the time of gameplay to maintain a clear chronological record.
2. **Source Identification**: Each data point includes information about its source for traceability and verification purposes.
3. **Data Integrity Checks**: The system performs checks to ensure the integrity of the data during aggregation, flagging any inconsistencies or errors.

## Edge Cases

1. **Partial Data**: In cases where not all required data is available, the system will provide partial results with a note indicating missing data.
2. **Data Corruption**: If data corruption is detected during aggregation, the system will flag the affected data points and continue processing the remaining data.
3. **Game Updates**: When game updates are released, the reporting system will adapt to capture new data points and adjust its analysis methods as needed.
