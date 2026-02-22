# Benchmark Run Framework Specification

## Overview

This document outlines the specifications for a standardized benchmark run framework in Point Zero One Digital's 12-minute financial roguelike game, Sovereign. The framework ensures consistency across all benchmark runs by implementing fixed seeds, pinned episode/ruleset versions, and standardized scoring outputs.

## Non-negotiables

1. **Fixed Seeds**: Each run must use a predefined seed to ensure reproducibility of results.
2. **Pinned Episode/Ruleset Versions**: The specific version of the episode or ruleset being benchmarked should be clearly stated and consistent across all runs.
3. **Standardized Scoring Outputs**: All scoring outputs must adhere to a predefined format for easy comparison and analysis.
4. **Pre/Post Measurement Rules**: Benchmarks should include both pre-measurement (before any optimization or changes) and post-measurement (after optimization or changes) results for accurate performance comparisons.

## Implementation Spec

1. **Seed Management**: Implement a seed management system to ensure consistent seed usage across all benchmark runs.
2. **Version Control**: Maintain version control for episodes and rulesets, ensuring that the specific versions being benchmarked are clearly stated.
3. **Scoring Output Format**: Develop a standardized scoring output format that includes relevant performance metrics such as frame rate, resource usage, and gameplay statistics.
4. **Pre/Post Measurement**: Implement pre-measurement and post-measurement routines to capture both baseline and optimized performance data.

## Edge Cases

1. **Seed Collisions**: In the event of seed collisions (two runs using the same seed), a unique seed should be automatically generated and used for the conflicting run.
2. **Version Conflicts**: If a version conflict arises between multiple teams or projects, a clear process should be established to resolve the issue and ensure consistency across all benchmark runs.
3. **Scoring Output Variations**: In cases where scoring outputs vary due to differences in hardware or software configurations, normalization techniques may be employed to facilitate comparison.
