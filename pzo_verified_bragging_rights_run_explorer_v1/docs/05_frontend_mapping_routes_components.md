# Frontend Mapping: Routes, Components, and OG Meta Service

## Overview

This document outlines the implementation of routes, components, and Open Graph (OG) meta service for the Point Zero One Digital's financial roguelike game. The focus is on the `pzo_verified_bragging_rights_run_explorer_v1` project.

## Non-negotiables

1. Strict TypeScript adherence, avoiding usage of 'any'.
2. All code in strict mode.
3. Deterministic effects across all components and routes.
4. Compliance with production-grade and deployment-ready infrastructure.
5. Anti-bureaucratic language for precise, execution-grade descriptions.

## Implementation Spec

### Routes

#### `/run/[id]/explorer`
- Displays the game run explorer interface for a specific game ID.
- Fetches game data based on the provided ID from the backend API.
- Renders the `ExplorerPage` component.

#### `/run/[id]/proof`
- Presents the proof of the game run with the given ID.
- Generates a proof using the game's deterministic algorithms.
- Displays the proof in a readable format within the `VerificationPanel`.

#### `/run/[id]/share`
- Allows users to share their game runs via social media or email.
- Renders the `SharePanel` component, which provides sharing options.
- Utilizes OG meta service for generating appropriate metadata for shared content.

### Components

#### `ExplorerPage`
- Contains the main explorer interface for a specific game run.
- Displays the pivotal turns list and other relevant information.

#### `PivotalTurnList`
- Represents the list of pivotal turns in a game run.
- Provides an interactive, user-friendly interface to navigate through turns.

#### `VerificationPanel`
- Displays the proof of a game run in a readable format.
- Ensures the proof's validity by verifying it against the game data.

#### `SharePanel`
- Allows users to share their game runs via social media or email.
- Generates appropriate metadata for shared content using OG meta service.

### OG Meta Service

- Provides Open Graph metadata generation capabilities.
- Ensures consistent and optimized metadata for shared content.
- Supports various social media platforms and email clients.

## Edge Cases

- Handling non-existent game IDs in the explorer, proof, and share routes.
- Invalid or tampered proofs in the verification panel.
- Inconsistencies in shared metadata due to platform-specific requirements.
