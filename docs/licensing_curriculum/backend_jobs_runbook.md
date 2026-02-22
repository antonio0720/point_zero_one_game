# Backend Jobs Runbook

## Overview

This runbook outlines the execution of various backend jobs in Point Zero One Digital's financial roguelike game. The jobs include report generation cadence, export workers, pack publish workflow, and failure recovery.

## Non-Negotiables

1. Strict TypeScript mode with no usage of 'any'.
2. Deterministic effects in all code.
3. Production-grade, deployment-ready infrastructure.
4. Cron/queue jobs for efficient job scheduling and execution.

## Implementation Spec

### Report Generation Cadence

1. Define the report generation frequency (e.g., daily, weekly, monthly).
2. Set up a Cron job to trigger the report generation script at the defined interval.
3. The script should fetch, process, and generate reports based on the current data.
4. Store generated reports in a designated storage location.

### Export Workers

1. Create export workers responsible for handling large-scale data exports.
2. Implement a queue system to manage the tasks assigned to each worker.
3. Each worker should process its tasks concurrently, ensuring efficient use of resources.
4. Upon completion, store the exported data in the designated storage location.

### Pack Publish Workflow

1. Define the pack publishing workflow, including versioning and deployment steps.
2. Set up a Cron job or queue system to trigger the pack publish script at specific intervals (e.g., daily).
3. The script should perform the necessary actions for packing, versioning, and deploying the game pack.
4. Monitor the pack publishing process for any errors and implement recovery mechanisms as needed.

### Failure Recovery

1. Implement error handling in all jobs to catch and log exceptions.
2. Set up a monitoring system to alert when errors occur during job execution.
3. Implement retry logic for jobs that fail due to transient issues (e.g., network connectivity).
4. If a job fails repeatedly, escalate the issue to the appropriate team member for manual intervention.

## Edge Cases

1. In case of data inconsistencies or corruption, implement data validation checks and recovery mechanisms.
2. When deploying new game pack versions, ensure compatibility with existing client installations.
3. If a job takes significantly longer than expected, investigate the cause and adjust resources or scheduling as needed.
