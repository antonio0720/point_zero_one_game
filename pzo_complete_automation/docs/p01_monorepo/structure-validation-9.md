# Monorepo with Source-of-Truth Trees - Structure Validation (Version 9)

This document outlines the ninth version of the structure validation strategy for monorepos utilizing source-of-truth trees.

## Overview

In a monorepo setup, managing the structure and consistency of multiple projects can be challenging. The Source-of-Truth Trees approach aims to maintain a well-organized and consistent repository by defining clear rules for project placement and organization. This document presents version 9 of our structure validation strategy.

## Key Changes in Version 9

### Project Naming Convention

1. All projects within the monorepo should have a descriptive and meaningful name, following the kebab-case naming convention (e.g., my-project).
2. Avoid using underscores or camelCase in project names as they can lead to confusion with file and folder naming.
3. Use prefixes to group related projects together (e.g., `api_`, `ui_`, `lib_` for API projects, UI components, and libraries respectively).
4. Ensure that the project name is unique within the monorepo to avoid potential conflicts.

### File Structure

1. Adopt a consistent file structure for all projects following a directory layout like:

```
my-project/
├── src/
│   ├── index.ts // Entry point for the project
│   └── ...
├── test/
│   ├── unit/
│   ├── integration/
│   └── ...
├── packages/
│   └── ... // External dependencies, if any
└── .gitignore // Include necessary file and folder exclusions
```

### Package.json

1. Each project should have a separate `package.json` file to manage its dependencies, scripts, and metadata.
2. Keep the project-specific configuration in the respective `package.json`.
3. Standardize common fields across all projects, such as:
- "name": The project name, conforming to the naming convention.
- "version": The Semantic Version (semver) of the project.
- "main": The entry point for the project (e.g., `dist/index.js` or `src/index.ts`).
- "types": The TypeScript declaration file for the project (e.g., `dist/index.d.ts` or `src/index.d.ts`).
- "scripts": Common scripts, like `build`, `test`, `lint`, and `format`.

## Best Practices

1. Maintain a consistent coding style across the entire monorepo using linters such as ESLint or Prettier.
2. Use Git submodules sparingly and only for integrating external libraries that are difficult to manage as dependencies.
3. Establish clear guidelines for adding, removing, or modifying projects within the monorepo.
4. Regularly review and update the structure validation strategy to accommodate new requirements and best practices.

By adhering to this structure validation strategy, you can ensure a well-organized, consistent, and scalable monorepo with Source-of-Truth Trees.
