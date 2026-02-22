# Monorepo Structure for Point Zero One Digital

This document outlines the structure and conventions for our monorepo layout, focusing on the `apps`, `backend`, `shared`, and `ops` directories.

## Overview

Our monorepo is organized into several main directories:

1. `apps`: Contains application-specific code for web and mobile platforms.
2. `backend`: Houses service-oriented backend components.
3. `shared`: Stores reusable contracts and utilities across the entire project.
4. `ops`: Manages operational scripts and configurations.

## Non-negotiables

1. **Strict TypeScript**: All code must be written in strict mode with no exceptions.
2. **Deterministic Effects**: All effects within the system should be deterministic to ensure predictable behavior.
3. **No 'any'**: Avoid using the `any` type in TypeScript for improved type safety and maintainability.
4. **Package Manager**: Use Yarn as our package manager for consistent dependency management across the project.
5. **Workspace Config**: Maintain a `yarn.lock` file to lock down dependencies at specific versions.

## Implementation Spec

### Apps Directory

- `apps/web`: Contains the web application codebase, including frontend components and TypeScript logic.
- `apps/mobile`: Houses the mobile application codebase, including native platform-specific code and shared logic in TypeScript.

### Backend Directory

- `backend/services/*`: Organizes service-oriented backend components by functionality. Each service should have its own directory with a descriptive name.

### Shared Directory

- `shared/contracts`: Stores interfaces, types, and other contractual agreements between modules to ensure compatibility and consistency.
- `shared/utils`: Contains reusable utility functions that can be shared across the entire project.

### Ops Directory

- `ops/*`: Manages operational scripts, configurations, and CI/CD pipelines for efficient deployment and maintenance of the project.

## Edge Cases

In cases where a module or component does not fit neatly into one of the above directories, create a new directory under the appropriate parent (e.g., `apps`, `backend`, or `shared`) with a descriptive name that reflects its purpose and functionality. Always prioritize maintainability, readability, and reusability when making decisions about monorepo structure.
