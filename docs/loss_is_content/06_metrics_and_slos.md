# Metrics and SLOs for Point Zero One Digital

## Overview

This document outlines the key metrics and Service Level Objectives (SLOs) for various aspects of Point Zero One Digital's game, focusing on post-loss re-engagement, fork usage, training clickthrough, time-to-next-run, and churn reduction. Additionally, SLOs for snippet generation are provided.

## Non-negotiables

1. **Strict TypeScript**: All code must adhere to strict mode with no exceptions. The `--strict` flag should be used during compilation.
2. **Deterministic effects**: All game effects must be deterministic, ensuring consistent outcomes for the same input.
3. **No 'any'**: Avoid using the `any` type in TypeScript. Instead, use specific types to maintain code clarity and reduce potential errors.
4. **Production-grade**: Code should be written with production environments in mind, focusing on scalability, reliability, and maintainability.
5. **Deployment-ready**: All code changes must be thoroughly tested and ready for deployment to the live environment.

## Implementation Spec

### Post-Loss Re-Engagement

Measure the percentage of players who return to play after experiencing a loss in the game. This metric helps us understand player retention and identify areas for improvement.

#### Calculation:

`(Number of returning players / Total number of lost players) * 100%`

### Fork Usage

Track the frequency and context of forks (game branches) to better understand player behavior and optimize game design.

#### Calculation:

`Total number of forks / Total number of games played`

### Training Clickthrough

Monitor the percentage of players who complete the training tutorial before starting the actual game. This metric helps us evaluate the effectiveness of our onboarding process.

#### Calculation:

`(Number of players who completed training / Total number of new players) * 100%`

### Time-to-Next-Run

Analyze the average time between consecutive game sessions for each player to assess engagement levels and identify potential bottlenecks.

#### Calculation:

`(Sum of time intervals between runs for all players) / (Total number of runs)`

### Churn Reduction

Calculate the percentage decrease in the churn rate over a specific period, indicating improvements in player retention and satisfaction.

#### Calculation:

`((Initial churn rate - Final churn rate) / Initial churn rate) * 100%`

### SLOs for Snippet Generation

Ensure the snippet generation service maintains an uptime of at least 99.95%. If the service is unavailable, a fallback mechanism should be in place to minimize impact on gameplay.

#### Calculation:

`1 - (Total downtime for a given period / Total time in that period)`
