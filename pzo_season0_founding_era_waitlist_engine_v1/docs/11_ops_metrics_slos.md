# Ops Metrics, SLAs, and Alerting Thresholds for pzo_season0_founding_era_waitlist_engine_v1

## Overview

This document outlines the key performance metrics, Service Level Objectives (SLOs), and alerting thresholds for the `pzo_season0_founding_era_waitlist_engine_v1`. The focus is on funnel metrics, retention metrics, trust metrics, and SLOs.

## Non-Negotiables

- All metrics are strictly defined and consistently measured across all environments.
- Metrics are collected in real-time for immediate analysis and action.
- All metrics comply with strict-mode TypeScript and deterministic effects.

## Implementation Spec

### Funnel Metrics

Funnel metrics track the progression of users through a series of defined steps within the waitlist engine. Key funnel metrics include:

1. **Add to Waitlist**: The number of unique users who have added themselves to the waitlist.
2. **Confirm Email**: The percentage of users who confirm their email address after adding themselves to the waitlist.
3. **Complete Registration**: The percentage of users who complete the registration process after confirming their email.
4. **Waitlist Position**: The average position of registered users on the waitlist.

### Retention Metrics (D1/D7 S0 vs non-S0)

Retention metrics measure user engagement and loyalty over time. Key retention metrics include:

1. **Daily Active Users (DAU)**: The number of unique users who engage with the waitlist engine on a given day.
2. **Weekly Active Users (WAU)**: The number of unique users who engage with the waitlist engine over a seven-day period.
3. **Retention Rate (D1/D7)**: The percentage of users who return to the waitlist engine within one or seven days, respectively.
4. **S0 Retention Rate (D1/D7)**: The retention rate for users who have purchased Sovereign membership compared to non-S0 users.

### Trust Metrics

Trust metrics measure user confidence and satisfaction with the waitlist engine. Key trust metrics include:

1. **Net Promoter Score (NPS)**: A measure of user loyalty based on their likelihood to recommend the waitlist engine to others.
2. **Support Ticket Response Time**: The average time it takes for support tickets to be responded to and resolved.
3. **User Feedback Ratings**: The average rating given by users in response to surveys about their experience with the waitlist engine.

### SLOs

Service Level Objectives (SLOs) define the expected level of service quality for each key metric. Key SLOs include:

1. **Add to Waitlist SLO**: A target percentage of users who add themselves to the waitlist within a given timeframe.
2. **Confirm Email SLO**: A target percentage of users who confirm their email address after adding themselves to the waitlist.
3. **Complete Registration SLO**: A target percentage of users who complete the registration process after confirming their email.
4. **Waitlist Position SLO**: A target average position for registered users on the waitlist.
5. **Daily Active Users (DAU) SLO**: A target number of daily active users.
6. **Weekly Active Users (WAU) SLO**: A target number of weekly active users.
7. **Retention Rate (D1/D7) SLO**: A target percentage of users who return to the waitlist engine within one or seven days, respectively.
8. **Support Ticket Response Time SLO**: A target response time for support tickets.
9. **User Feedback Ratings SLO**: A target average rating given by users in response to surveys about their experience with the waitlist engine.

### Alerting Thresholds

Alerting thresholds trigger notifications when key metrics deviate from expected values. Key alerting thresholds include:

1. **Add to Waitlist**: If the percentage of users who add themselves to the waitlist falls below the Add to Waitlist SLO for more than 24 hours.
2. **Confirm Email**: If the percentage of users who confirm their email address falls below the Confirm Email SLO for more than 24 hours.
3. **Complete Registration**: If the percentage of users who complete the registration process falls below the Complete Registration SLO for more than 24 hours.
4. **Waitlist Position**: If the average position for registered users on the waitlist exceeds the Waitlist Position SLO for more than 24 hours.
5. **Daily Active Users (DAU)**: If the number of daily active users falls below the DAU SLO for more than 24 hours.
6. **Weekly Active Users (WAU)**: If the number of weekly active users falls below the WAU SLO for more than seven days.
7. **Retention Rate (D1/D7)**: If the retention rate falls below the Retention Rate (D1/D7) SLO for more than 24 hours or seven days, respectively.
8. **Support Ticket Response Time**: If the average response time for support tickets exceeds the Support Ticket Response Time SLO for more than 24 hours.
9. **User Feedback Ratings**: If the average rating given by users in response to surveys about their experience with the waitlist engine falls below the User Feedback Ratings SLO for more than seven days.
