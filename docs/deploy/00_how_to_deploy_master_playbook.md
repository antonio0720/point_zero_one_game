# Master Deployment Playbook

This playbook outlines the deployment process for all launch surface areas in Point Zero One Digital's 12-minute financial roguelike game. The following sections detail dependency order, gating flags, rollback plan, and links to source zips.

## Overview

The master deployment playbook covers the following components:

1. Integrity Page
2. Trust/Run Explorer
3. Two-Tier Ladder
4. Season 0 Waitlist
5. Host OS
6. Creator Economy

Each component has its specific dependencies, gating flags, and rollback plan.

## Non-Negotiables

1. Strict TypeScript mode: All code adheres to strict-mode for type safety.
2. Deterministic effects: All game effects are designed to be deterministic for reproducibility.
3. No 'any' in TypeScript: Avoid using the 'any' type for better type checking and code maintainability.
4. Production-grade deployment: Deployments should be ready for production environments.

## Implementation Spec

### Integrity Page

Dependency: None
Gating Flag: `integrity_page_deployed`
Rollback Plan: Revert to previous version or fallback page.
Source Zip: [verified_bragging_rights](https://github.com/PointZeroOneDigital/verified_bragging_rights/archive/refs/heads/main.zip)

### Trust/Run Explorer

Dependency: Integrity Page
Gating Flag: `trust_run_explorer_deployed`
Rollback Plan: Revert to previous version or default landing page.
Source Zip: [two_tier_ladder](https://github.com/PointZeroOneDigital/two_tier_ladder/archive/refs/heads/main.zip) (Trust Explorer section)

### Two-Tier Ladder

Dependency: Trust/Run Explorer
Gating Flag: `two_tier_ladder_deployed`
Rollback Plan: Revert to previous version or default landing page.
Source Zip: [two_tier_ladder](https://github.com/PointZeroOneDigital/two_tier_ladder/archive/refs/heads/main.zip) (Two-Tier Ladder section)

### Season 0 Waitlist

Dependency: Two-Tier Ladder
Gating Flag: `season0_waitlist_deployed`
Rollback Plan: Revert to previous version or default landing page.
Source Zip: [season0_waitlist_engine](https://github.com/PointZeroOneDigital/season0_waitlist_engine/archive/refs/heads/main.zip)

### Host OS

Dependency: Season 0 Waitlist
Gating Flag: `host_os_deployed`
Rollback Plan: Revert to previous version or default operating system.
Source Zip: [host_os_kit](https://github.com/PointZeroOneDigital/host_os_kit/archive/refs/heads/main.zip)

### Creator Economy

Dependency: Host OS
Gating Flag: `creator_economy_deployed`
Rollback Plan: Revert to previous version or disable Creator Economy features.
Source Zip: [creator_economy_pipeline](https://github.com/PointZeroOneDigital/creator_economy_pipeline/archive/refs/heads/main.zip)
