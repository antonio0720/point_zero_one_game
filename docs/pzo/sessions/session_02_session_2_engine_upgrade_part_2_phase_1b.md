# Session 2: Engine Upgrade Part 2 - Phase 1B

## Overview

This session is part of the Engine Upgrade process and focuses on upgrading the engine to the latest version.

## Prerequisites

* The system must be in a stable state.
* The previous phase (Phase 1A) must have been completed successfully.
* The necessary permissions and access rights must be granted to perform this upgrade.

## Commands

### Step 1: Backup the Current Engine Configuration

```bash
pzo-engine-backup -c /path/to/current/config
```

**Done Criteria:** The backup process completes without errors, and a valid backup file is created at the specified location.

### Step 2: Download the Latest Engine Version

```bash
pzo-engine-download --version latest
```

**Done Criteria:** The download process completes successfully, and the new engine version is downloaded to the default location.

### Step 3: Upgrade the Engine Configuration

```bash
pzo-engine-upgrade -c /path/to/current/config -n /path/to/new/engine/version
```

**Done Criteria:** The upgrade process completes without errors, and the engine configuration is successfully updated.

## Smoke Tests

### Step 1: Verify Engine Version

```bash
pzo-engine-version
```

**Expected Output:** The latest engine version number.

### Step 2: Test Engine Functionality

```bash
pzo-engine-test -f /path/to/test/file
```

**Expected Output:** No errors, and the test file is processed successfully.

## Next Steps

* Proceed to Phase 1C for further upgrade steps.
* Verify system stability and performance after the upgrade.
