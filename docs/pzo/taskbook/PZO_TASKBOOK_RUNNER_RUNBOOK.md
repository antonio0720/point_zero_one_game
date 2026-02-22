# PZO Taskbook Runner Runbook

## Overview

This runbook outlines the procedures for running `taskbook_runner` in various modes: dry-run, apply, resume, rollback, and verify.

## Non-Negotiables

1. Strict TypeScript mode is enforced.
2. Avoid using 'any' in your code.
3. All effects are deterministic.
4. Production-grade and deployment-ready.

## Implementation Spec

### Dry-Run

To execute a dry-run, use the following command:

```bash
npm run taskbook:dry-run
```

This will simulate the execution of tasks without making any actual changes to the infrastructure.

### Apply

To apply changes to the infrastructure, use the following command:

```bash
npm run taskbook:apply
```

This will execute the tasks and make the necessary changes to the infrastructure.

### Resume

If a previous run was interrupted or aborted, you can resume it using the following command:

```bash
npm run taskbook:resume
```

### Rollback

In case of an error during apply, you can rollback to the previous state with this command:

```bash
npm run taskbook:rollback
```

### Verify

To verify the current state of the infrastructure, use the following command:

```bash
npm run taskbook:verify
```

## Edge Cases

- If a task fails during apply or resume, the entire operation will be aborted. To continue, you must manually fix the issue and then run `taskbook:resume`.
- In case of a network interruption during apply or resume, the operation may be automatically retried after a short delay. If the issue persists, manually restart the operation using `taskbook:resume`.
