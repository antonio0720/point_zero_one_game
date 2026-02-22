# ADMIN CONSOLE PLAYBOOKS v1.0

## Overview

This document outlines the design and implementation of admin console playbooks for daily operations management in Point Zero One Digital's financial roguelike game, Sovereign. The playbooks aim to provide a streamlined interface for monitoring queue health, handling failures, managing risk spikes, placement, revenue share, and governance actions with evidence receipts. Additionally, they include features for incident response during junk-flood events, such as feature flag freeze and sandbox-only mode.

## Non-negotiables

1. Strict TypeScript adherence, avoiding the use of 'any'. All code is written in strict mode.
2. Deterministic effects for predictable game behavior.
3. User-friendly interface with clear visual indicators and action options.
4. Comprehensive logging and evidence receipts for all admin actions.
5. Robust incident response mechanisms during junk-flood events.

## Implementation Spec

### Daily Ops Panels

#### Queue Health

- Monitor the health of game queues in real-time, displaying average wait times, queue lengths, and success/failure rates.
- Provide options to prioritize or pause specific queues as needed.

#### Failures & Risk Spikes

- Identify and isolate failures within the system, providing detailed logs for troubleshooting.
- Detect and alert on risk spikes, allowing admins to take corrective action before they impact gameplay.

#### Placement & Revenue Share

- Manage player placement within the game, ensuring a balanced and fair distribution of resources.
- Monitor revenue share between players and adjust as necessary to maintain a healthy economy.

### Governed Admin Actions

- Allow admins to perform actions with evidence receipts, providing transparency and accountability for all changes made to the game environment.

### Incident Response (Junk-Flood)

#### Feature Flag Freeze

- Temporarily freeze feature flag updates during junk-flood events to prevent unintended consequences.

#### Sandbox-Only Mode

- Switch the game into sandbox mode, allowing only controlled testing and development during junk-flood incidents.

## Edge Cases

- In the event of a prolonged junk-flood incident, admins may need to manually adjust queue priorities or revenue share distributions to maintain game balance.
- During sandbox-only mode, it is essential to ensure that all changes are thoroughly tested before being deployed to the live game environment.
