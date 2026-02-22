# Share Copy and Templates - Sovereign Infrastructure Architecture Rules

## Overview

This document outlines the rules for sharing copy and templates within Point Zero One Digital's 12-minute financial roguelike game, ensuring production-grade, deployment-ready, deterministic effects and maintaining strict adherence to privacy regulations.

## Non-negotiables

1. **Data Privacy**: All shared artifacts must not contain any Personally Identifiable Information (PII).
2. **Markdown Format**: All shared documents should be in Markdown format for ease of collaboration and version control.
3. **Deterministic Effects**: All effects in the game should be deterministic to ensure fairness and reproducibility.
4. **TypeScript Strict Mode**: All code should be written in TypeScript strict mode, avoiding the use of 'any'.
5. **Deployment Readiness**: All shared templates must be ready for production deployment.

## Implementation Spec

### Sharing Copy

1. **Markdown Documentation**: When sharing game-related information, always provide a complete Markdown document. Avoid preambles or unnecessary fluff.
2. **Data Sanitization**: Before sharing any data, ensure it is sanitized to remove any PII.
3. **Version Control**: Utilize version control systems like Git for tracking changes and collaborating on documents.
4. **Code Review**: Implement code review processes to ensure adherence to the strict-mode TypeScript rule and deterministic effects.

### Templates

1. **Template Design**: Templates should be designed with production deployment in mind, ensuring they are efficient, scalable, and maintainable.
2. **Code Quality**: Maintain high code quality by following best practices for TypeScript strict mode and deterministic effects.
3. **Testing**: Implement thorough testing to ensure templates work as intended and do not introduce any unintended consequences or bugs.
4. **Documentation**: Document templates clearly, including their purpose, usage, and any relevant edge cases.

## Edge Cases

1. **PII Leakage**: In case of accidental PII leakage in shared artifacts, immediately rectify the issue and implement measures to prevent future occurrences.
2. **Template Malfunction**: If a template malfunctions during deployment, investigate the cause, fix the issue, and update relevant documentation.
3. **Version Control Conflicts**: In case of version control conflicts, resolve them promptly to ensure all team members have access to the most up-to-date information.
