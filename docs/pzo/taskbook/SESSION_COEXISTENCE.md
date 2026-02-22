# Session Coexistence

## Overview

This document outlines the technical requirements and implementation details for running `pzo-build` and `road-to-1200` simultaneously using tmux session isolation and shared Ollama resource management, while adhering to CPU/RAM budgets.

## Assumptions

* The reader is familiar with tmux and its basic usage.
* The reader has a basic understanding of Ollama and its resource management capabilities.
* The reader has access to a system that meets the minimum hardware requirements for running both `pzo-build` and `road-to-1200`.

## Session Isolation

To ensure coexistence, we will utilize tmux session isolation. This involves creating separate tmux sessions for each application, with their own set of windows and panes.

### Creating Sessions

1. Start a new tmux session for `pzo-build` using the command: `tmux new-session -s pzo-build`
2. Start a new tmux session for `road-to-1200` using the command: `tmux new-session -s road-to-1200`

### Sharing Resources

To share resources between sessions, we will utilize Ollama's built-in resource management capabilities.

1. Configure Ollama to manage resources for both sessions by adding the following configuration to your `ollama.yml` file:
```yaml
resources:
  cpu: 2
  ram: 4G
```
This configuration allocates 2 CPU cores and 4GB of RAM to each session.

### Running Applications

1. Run `pzo-build` in its designated tmux session using the command: `tmux attach-session -t pzo-build && pzo-build`
2. Run `road-to-1200` in its designated tmux session using the command: `tmux attach-session -t road-to-1200 && road-to-1200`

## CPU/RAM Budgets

To ensure that both applications run within their allocated budgets, we will utilize Ollama's built-in monitoring and alerting capabilities.

1. Configure Ollama to monitor CPU and RAM usage for each session by adding the following configuration to your `ollama.yml` file:
```yaml
monitors:
  - cpu: pzo-build
    threshold: 80%
  - ram: road-to-1200
    threshold: 90%
```
This configuration sets alerts for when CPU usage exceeds 80% in the `pzo-build` session or RAM usage exceeds 90% in the `road-to-1200` session.

## Conclusion

By following these steps, you can successfully run `pzo-build` and `road-to-1200` simultaneously using tmux session isolation and shared Ollama resource management, while adhering to CPU/RAM budgets.
