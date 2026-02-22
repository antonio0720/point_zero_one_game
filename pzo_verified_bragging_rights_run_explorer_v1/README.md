# Point Zero One Digital - Verified Bragging Rights Run Explorer v1

A 12-minute financial roguelike game built on Sovereign infrastructure architecture, designed for production-grade and deployment-ready use. All code adheres to strict TypeScript mode with deterministic effects.

## Overview

The Verified Bragging Rights Run Explorer (VBRE) is a tool that allows users to explore various game runs of Point Zero One Digital's 12-minute financial roguelike game. It provides insights into the game's outcomes, offering players an opportunity to analyze their strategies and improve their performance.

## Non-negotiables

1. **TypeScript Strict Mode**: All code is written in TypeScript with strict mode enabled for type safety and consistency.
2. **Deterministic Effects**: All game effects are designed to be deterministic, ensuring reproducible results across different runs.
3. **Production-Grade & Deployment-Ready**: The VBRE is built with production in mind, following best practices for scalability and reliability.
4. **No 'any' TypeScript Usage**: To maintain type safety, the VBRE does not use the 'any' type in TypeScript.

## Implementation Spec

### Backend

- Game run data is stored in a PostgreSQL database with a custom schema designed for efficient querying and analysis.
- A Node.js server handles API requests, using Express.js for routing and handling HTTP requests.
- The backend communicates with the frontend via GraphQL over HTTP.

### Frontend

- The frontend is built using React.js, providing a user-friendly interface for exploring game runs.
- Apollo Client is used to make GraphQL queries to the backend server.
- Data visualization is handled by Chart.js and D3.js libraries.

## Edge Cases

- In case of database errors or downtime, the VBRE includes error handling mechanisms to gracefully handle such situations and provide users with appropriate error messages.
- The system is designed to handle large amounts of game run data, ensuring performance remains optimal even as the number of runs increases.
