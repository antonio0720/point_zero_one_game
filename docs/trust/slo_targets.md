# SLO Targets for Point Zero One Digital Services

## Overview

This document outlines Service Level Objectives (SLOs) for key performance metrics in Point Zero One Digital's financial roguelike game, focusing on explorer load times, verification completion times, OG render latency, and error budgets.

## Non-Negotiables

1. **Determinism**: All SLO targets must be deterministic to ensure predictable service behavior.
2. **Strict TypeScript**: The code adheres strictly to TypeScript, avoiding the use of 'any'.
3. **Error Budgets**: Error budgets are allocated for each SLO to manage acceptable levels of service disruption.

## Implementation Spec

### Explorer Load Times (ELT)
- Target: 100ms median response time at the 95th percentile.
- Error Budget: 5% of total time per month, with a grace period of 7 days for recovery.

### Verification Completion Times (VCT)
- Target: 200ms median response time at the 95th percentile.
- Error Budget: 3% of total time per month, with a grace period of 5 days for recovery.

### OG Render Latency (ORL)
- Target: 50ms median response time at the 95th percentile.
- Error Budget: 2% of total time per month, with a grace period of 3 days for recovery.

## Edge Cases

In case of unexpected traffic spikes or unforeseen circumstances leading to SLO breaches, the system should prioritize service availability over strict adherence to SLO targets. However, it is crucial to communicate any such deviations and implement corrective measures promptly.
