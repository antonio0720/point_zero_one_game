# Institution Dashboards Specification for Point Zero One Digital's Cohort Analysis

## Overview

This document outlines the specifications for the Institution Dashboards feature in Point Zero One Digital's 12-minute financial roguelike game. The dashboard provides a comprehensive view of cohort survival, failure modes, deltas, and participation data, as well as privacy boundaries and export rules.

## Non-Negotiables

1. **Data Accuracy**: All data displayed on the dashboard must be accurate and up-to-date to ensure reliable analysis.
2. **Deterministic Results**: The dashboard's calculations should be deterministic, ensuring consistent results across multiple runs.
3. **Privacy Compliance**: User privacy must be respected at all times. Sensitive data should not be displayed or shared without explicit user consent.
4. **Export Functionality**: Users should have the ability to export their data in a format suitable for further analysis or record-keeping.
5. **Strict TypeScript**: All code adheres to strict TypeScript mode, avoiding the use of 'any'.
6. **Deployment Readiness**: The dashboard is designed to be production-grade and ready for deployment upon completion.

## Implementation Spec

### Cohort Survival by Scenario

The dashboard will display survival rates for each cohort in different game scenarios. This data will help users understand how their strategies perform under various conditions.

### Failure Modes and Deltas

The dashboard will show failure modes, such as bankruptcy or game over, for each cohort. Additionally, it will display deltas between cohorts to highlight performance differences.

### Participation

The dashboard will track participation rates for each cohort, providing insights into user engagement levels.

### Privacy Boundaries

User data will be anonymized and aggregated to maintain privacy. Individual user data will not be displayed without explicit consent.

### Export Rules

Users will have the option to export their data in a CSV format for further analysis or record-keeping. Exported data will only include anonymized, aggregated information to ensure privacy compliance.

## Edge Cases

1. **Incomplete Data**: If there is insufficient data for a cohort or scenario, the dashboard should clearly indicate this and provide suggestions for gathering more data.
2. **Privacy Violations**: In case of accidental privacy violations, the system should have mechanisms in place to rectify the issue promptly and notify affected users.
