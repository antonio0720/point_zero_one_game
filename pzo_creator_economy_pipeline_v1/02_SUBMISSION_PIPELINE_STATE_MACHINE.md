# Point Zero One Digital - Submission Pipeline State Machine (v1)

## Overview

This document outlines the design and implementation of a state machine for the submission pipeline in Point Zero One Digital's financial roguelike game. The state machine manages the lifecycle of a submission from DRAFT to LIVE, RETIRED, or QUARANTINED states, with no-stall defaults and maximum wait times specified. Receipts are generated for every transition, and a stage timer contract is included for tracking submission durations.

## Non-negotiables

1. Strict TypeScript adherence: No usage of 'any' type. All code will be written in strict mode.
2. Deterministic effects: All actions within the state machine must produce predictable results.
3. Maximum wait times: Each state will have a defined maximum wait time before automatically transitioning to the next state or being quarantined.
4. Receipts for transitions: A record of each transition will be generated and stored for auditing purposes.
5. Stage timer contract: A smart contract will be implemented to track the duration of each submission stage.

## Implementation Spec

### States

- **DRAFT**: The initial state for a new submission. Submissions in this state can be edited, but are not yet available for review or deployment.
- **LIVE**: The active state for a deployed submission. Submissions in this state are accessible to players and generate revenue.
- **RETIRED**: The state for submissions that have been removed from active service. Retired submissions are no longer accessible to players but may still be audited or analyzed.
- **QUARANTINED**: The state for submissions that require further review due to potential issues or errors. Submissions in this state will not be accessible to players until they have been cleared by the review team.

### Transitions

1. DRAFT → LIVE: A submission can transition from draft to live when it has passed all necessary reviews and is deemed ready for deployment. The transition generates a receipt detailing the review process and any changes made during that process.
2. LIVE → RETIRED: A submission can be retired manually by the game administrators or automatically after reaching a predefined age or revenue threshold. The transition generates a receipt detailing the reasons for retirement.
3. LIVE → QUARANTINED: A submission can be quarantined if it is found to have issues or errors that require further investigation. The transition generates a receipt detailing the nature of the issue and any actions required to resolve it.
4. QUARANTINED → DRAFT: A submission can return to draft status after being cleared by the review team following resolution of any identified issues. The transition generates a receipt detailing the results of the review and any necessary changes made during that process.
5. QUARANTINED → RETIRED (edge case): If a submission in quarantine remains unresolved for an extended period, it may be automatically retired to prevent potential disruptions to gameplay. The transition generates a receipt detailing the reasons for retirement and any attempts made to resolve the issue.

### Max Wait Times

- DRAFT → LIVE: 7 days (10080000 ms)
- LIVE → RETIRED: 30 days (259200000 ms)
- LIVE → QUARANTINED: No maximum wait time, but the review team will aim to complete their assessment within 48 hours (47900000 ms).
- QUARANTINED → DRAFT/RETIRED: No maximum wait time, but the submission will remain in quarantine until it is cleared or retired.

### Stage Timer Contract

A smart contract will be implemented to track the duration of each stage for every submission. The contract will store the start and end times for each state transition, allowing for easy auditing and analysis of submission durations.

## Conclusion

This state machine design provides a robust and efficient framework for managing submissions within Point Zero One Digital's financial roguelike game. By enforcing strict TypeScript adherence, deterministic effects, maximum wait times, receipts for transitions, and a stage timer contract, we ensure a production-grade, deployment-ready solution that meets the needs of our users and the demands of our business.
