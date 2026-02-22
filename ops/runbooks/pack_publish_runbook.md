---
title: Pack Publish Runbook
description: Guidelines for publishing a new game pack and cohort rollout strategy
author: DevOps Team, Point Zero One Digital
date: YYYY-MM-DD
version: 1.0.0

# Required inputs
game_pack_name: "latest"
cohort_size: 5000
rollback_plan: true

# Optional inputs (defaults provided)
deployment_environment: "production"
deployment_region: "us-west-2"

---

# Deployment Steps

## Preparation
1. Verify game pack is built and available in the artifact repository
2. Ensure all required dependencies are up to date
3. Validate rollback plan (if enabled)

## Deployment
### Publish Game Pack
```

Shell Script:

```bash
#!/bin/bash

set -euo pipefail

# Constants
GAME_PACK_NAME="${1:-latest}"
DEPLOYMENT_ENVIRONMENT="${2:-production}"
DEPLOYMENT_REGION="${3:-us-west-2}"
ROLLBACK_PLAN="${4:-true}"

# Preparation
if ! artifact_exists "${GAME_PACK_NAME}"; then
    echo "Error: Game pack ${GAME_PACK_NAME} not found in artifact repository"
    exit 1
fi

if ! dependencies_up_to_date; then
    echo "Error: Dependencies are not up to date. Please update before deploying."
    exit 1
fi

if ${ROLLBACK_PLAN}; then
    rollback_plan
fi

# Deployment
publish_game_pack "${GAME_PACK_NAME}"

# Cohort Rollout
deploy_to_environment "${DEPLOYMENT_ENVIRONMENT}" "${DEPLOYMENT_REGION}" "${GAME_PACK_NAME}"

# Logging and Notifications
log_deployment "${DEPLOYMENT_ENVIRONMENT}" "${GAME_PACK_NAME}"

# Rollback Notes
if ${ROLLBACK_PLAN}; then
    echo "Rollback plan executed successfully. Monitor logs for any issues."
fi
```

Grafana JSON:

```json
{
  "title": "Deployment Dashboard",
  "panels": [
    {
      "title": "Logs",
      "type": "loki",
      "style": "dark",
      "datasource": "Loki",
      "query": "logs.level=info logs.source=deployment",
      "refresh": true,
      "timeFrom": "-5m",
      "timeShift": 60,
      "height": 300
    },
    {
      "title": "Error Rate",
      "type": "graph",
      "style": "dark",
      "datasource": "Prometheus",
      "query": "error_rate{source=\"deployment\"}",
      "refresh": true,
      "height": 300
    }
  ]
}
