# Monorepo with Source-of-Truth Trees - Dependency Graph 2

This document outlines the second iteration of our approach to managing dependencies in a monorepo using source-of-truth trees.

## Overview

In this setup, we leverage the power of a monorepo for managing multiple projects under one roof while maintaining an organized dependency structure through the use of source-of-truth trees. This approach ensures clean and consistent dependencies across the entire repository.

### Key Components

1. **Monorepo**: A single repository that contains multiple projects, libraries, or services.

2. **Source-of-Truth Trees**: These trees are used to represent the actual dependency graph of our monorepo. Each node in the tree represents a project, and the edges between nodes denote dependencies between them. The source-of-truth trees serve as the foundation for managing and resolving conflicts in our dependency structure.

### Dependency Resolution Strategy

1. **Topological Sort**: To resolve potential cyclic dependencies, we perform a topological sort on the source-of-truth tree. The sorted order guarantees that each project's dependencies are available before it is built.

2. **Lock Files**: For reproducibility, we generate lock files for each project at specific points in our monorepo's lifecycle (e.g., after dependency updates or merges). These lock files ensure consistent builds and minimize conflicts caused by version changes.

## Benefits

- Consistent dependencies across the entire repository
- Minimized conflicts due to version changes
- Simplified maintenance and upgrades of dependencies
- Improved collaboration among team members

## Limitations and Considerations

- Potential increased disk usage due to multiple copies of shared libraries
- Increased complexity when dealing with transitive dependencies
- Potential issues during merges if lock files diverge between branches
- Careful handling is needed when adding or removing projects from the monorepo

## Conclusion

Using a monorepo with source-of-truth trees provides many benefits for managing dependencies. By addressing limitations and considering best practices, teams can effectively maintain their monorepos while enjoying the advantages of a clean dependency structure.
