# Point Zero One Digital Experiment Constraints

This document outlines the rules governing experiments in the context of our financial roguelike game, Sovereign Infrastructure Architect Design.

## Overview

Experiments are crucial for continuous improvement and innovation within our production-grade, deployment-ready system. However, they must be governed by strict rules to ensure deterministic behavior, maintain code integrity, and prevent unintended consequences.

## Non-negotiables

1. **Output**: All experiments must output complete TypeScript code that adheres to our strict-mode standards. No exceptions.
2. **TypeScript**: The use of 'any' is strictly prohibited in all experiments.
3. **Determinism**: All effects resulting from an experiment must be deterministic, ensuring predictable behavior and reproducibility.
4. **Code Quality**: Experiments should not compromise the quality or readability of our codebase.

## Implementation Spec

1. **Compiler Rules**: The TypeScript compiler settings for each experiment must be explicitly defined and adhered to.
2. **Allowed Variations**: Each experiment should clearly specify the variations it introduces, whether they are new features, modifications to existing functionality, or changes in behavior.
3. **Invariants**: Experiments should not violate any established invariants within our codebase. If an invariant must be temporarily suspended for an experiment, this should be explicitly documented and justified.
4. **Kill-Switch Thresholds**: Each experiment should define a threshold at which it can be safely terminated or rolled back if it introduces unintended consequences or performance issues.

## Edge Cases

1. **Code Merge Conflicts**: In the event of merge conflicts between experimental and main branches, the experimental code must yield to ensure the stability of our production-ready system.
2. **Performance Issues**: If an experiment introduces performance issues that exceed its kill-switch threshold, it should be terminated or rolled back immediately.
3. **Security Vulnerabilities**: Any experiment that introduces a security vulnerability must be halted and addressed promptly to prevent potential harm to our system or users.
