# Pricing Models for Point Zero One Digital Partnerships

## Overview

This document outlines the key pricing models used in partnership agreements with Point Zero One Digital (PZOD). The models include Per-Month-Per-User (PMPM), Per-Employee-Per-Month (PEPM, active), and broker-enabled revenue share.

## Non-Negotiables

1. All pricing models are strictly defined and non-negotiable.
2. All code is written in TypeScript using strict mode with a commitment to never use the 'any' type.
3. All effects in our games are deterministic, ensuring fairness and reproducibility.
4. Default pricing guardrails and renewal levers are predefined and non-negotiable.

## Implementation Spec

### Per-Month-Per-User (PMPM)

PMPM is a subscription model where partners pay a fixed fee per user, per month. The fee is calculated based on the number of active users accessing the game during each billing cycle.

#### Edge Cases

1. Inactive users do not count towards the PMPM fee.
2. Partners are responsible for accurately reporting their active user count to avoid over or underpayment.

### Per-Employee-Per-Month (PEPM, active)

PEPM is a subscription model where partners pay a fixed fee per active employee, per month. The fee is calculated based on the number of active employees working on the integration and support of PZOD games.

#### Edge Cases

1. Inactive employees do not count towards the PEPM fee.
2. Partners are responsible for accurately reporting their active employee count to avoid over or underpayment.

### Broker-Enabled Revenue Share

In some cases, revenue share models may be enabled through a broker agreement. These agreements will outline the specific terms of the revenue share, including the percentage of revenue shared and any additional fees or conditions.

#### Edge Cases

1. Revenue share models are only available through approved brokers.
2. Partners must adhere to all terms outlined in the broker agreement.

## Default Pricing Guardrails

1. All pricing is quoted in USD.
2. Billing cycles are monthly, with invoices sent on the first day of each month.
3. Payment terms are net 30 days from the invoice date.
4. Late payment may result in service suspension or termination.

## Renewal Levers

1. Partnership agreements have an initial term of one year, with automatic renewal unless either party provides written notice of termination at least 60 days prior to the end of the term.
2. Pricing may be subject to annual review and adjustment based on changes in costs or market conditions.
