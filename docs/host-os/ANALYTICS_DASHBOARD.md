# Admin Guide: Analytics Dashboard

## Overview

This guide outlines the components and calculations of the Analytics Dashboard for Point Zero One Digital's financial roguelike game hosted on various operating systems. The dashboard provides insights into host health, cohort definitions, churn signals, and stages in the GHL pipeline for hosts.

## Non-Negotiables

1. **Host Health Score Formula**: Calculate the Host Health Score (HHS) using the following formula:
   ```
   HHS = (GamePlayTime / TotalGameTime) * (SuccessfulTransactions / TotalTransactions) * (Uptime / TotalTime)
   ```
   - `GamePlayTime`: Time spent by players in actual gameplay.
   - `TotalGameTime`: Total time the host was active, including idle periods.
   - `SuccessfulTransactions`: Number of successful financial transactions during gameplay.
   - `TotalTransactions`: Total number of financial transactions attempted during gameplay.
   - `Uptime`: Time the host was operational and available for players.
   - `TotalTime`: Total time the host was supposed to be operational, including downtimes.

2. **Cohort Definitions**: Define cohorts based on specific criteria such as game version, operating system, or player demographics.

3. **Churn Signals**: Identify and display key indicators that suggest a potential increase in host churn, such as decreasing HHS, reduced gameplay time, or an increase in failed transactions.

4. **GHL Pipeline Stages for Hosts**: Display the current stage of each host within the Game-Hosting-Lifecycle (GHL) pipeline:
   - **Provisioning**
   - **Staging**
   - **Production**
   - **Retirement**

5. **Weekly Review Checklist**: Provide a checklist for weekly reviews, including:
   - Analyzing host health scores and identifying trends.
   - Investigating churn signals and taking corrective actions.
   - Monitoring GHL pipeline stages and addressing any issues.
   - Updating cohort definitions as necessary.

## Implementation Spec

The Analytics Dashboard will be implemented using TypeScript in strict mode, ensuring deterministic effects and avoiding the use of 'any'. The dashboard will be designed to provide real-time insights for easy decision-making and optimization of Point Zero One Digital's infrastructure.

## Edge Cases

1. **Zero GamePlayTime**: In cases where a host has zero gameplay time, assign a small arbitrary value (e.g., 1 second) to ensure the HHS calculation does not result in division by zero.

2. **Failed Transactions**: If a transaction fails due to reasons outside the host's control (e.g., network issues), consider excluding such transactions from the TotalTransactions count to maintain accuracy in the HHS calculation.
