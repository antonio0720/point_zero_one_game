# SLO Targets for Season0

## Overview

This document outlines the Service Level Objectives (SLOs) for Point Zero One Digital's Season0, a 12-minute financial roguelike game. The SLOs are designed to ensure high performance, reliability, and determinism in our infrastructure.

## Non-Negotiables

1. **JoinSeason0 p95**: Achieve a 95th percentile response time of less than 12 minutes for joining Season0. This includes the time taken to download assets, initialize game data, and connect to the game server.

2. **Artifact Grant p95**: Ensure a 95th percentile response time of less than 1 second for granting artifacts. Artifact grants occur when players complete certain in-game tasks or milestones.

3. **Stamp Mint p95**: Achieve a 95th percentile response time of less than 0.1 seconds for minting stamps. Stamp minting occurs when players achieve specific in-game achievements or purchase items.

4. **OG Render p95**: Ensure a 95th percentile response time of less than 1 second for rendering the Overworld Graphics (OG). This includes loading and rendering game assets, terrain, and characters.

5. **Error Budget**: Maintain an error budget of no more than 5% per month. This means that errors should not exceed 5% of total requests in a given month.

## Implementation Spec

All SLOs are to be measured using production-grade monitoring tools and techniques. The response times are averages calculated over a rolling 7-day window. If an SLO is breached, the team will investigate and implement corrective actions as necessary.

## Edge Cases

1. **Network Latency**: Response times may be affected by network latency, which can vary based on geographical location and internet service provider. To account for this, we will monitor response times from multiple locations and ISPs.

2. **Concurrent Requests**: If a user makes multiple requests simultaneously (e.g., joining Season0, minting stamps, and requesting artifacts), the response times may be affected. We will ensure our systems can handle concurrent requests efficiently to minimize impact on SLOs.

3. **Server Maintenance**: During scheduled server maintenance, SLOs may temporarily be breached. We will communicate any planned downtime in advance and aim to complete maintenance as quickly as possible to minimize disruption.
