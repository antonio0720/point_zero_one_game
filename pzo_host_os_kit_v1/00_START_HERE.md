# 5-Minute Setup Guide for Point Zero One Digital

## Overview

This guide provides a concise and efficient setup process for Point Zero One Digital (PZOD), a 12-minute financial roguelike game, on your Host Operating System (OS). The guide covers essential operations, non-negotiables, implementation specifics, and edge cases.

## Non-Negotiables

1. Strict TypeScript mode: All code adheres to strict-mode for enhanced type safety.
2. Deterministic effects: All game effects are designed to be deterministic, ensuring fairness and reproducibility.
3. Avoid 'any' in TypeScript: To maintain type safety, the use of 'any' is strictly prohibited.
4. Minimum Viable Recording Rules: Essential data recording rules are implemented for game analysis and debugging purposes.
5. Consent + Safety Script: A script is provided to ensure user consent and prioritize safety during gameplay.

## Implementation Spec

### 5-Minute Setup Guide

1. Install Node.js (version 14 or later) from [official website](https://nodejs.org/).
2. Clone the PZOD repository: `git clone https://github.com/PointZeroOneDigital/pzo_host_os_kit_v1.git`
3. Navigate to the cloned directory: `cd pzo_host_os_kit_v1`
4. Install dependencies: `npm install`
5. Start the game server: `npm start`

### Night Types (Casual/Community/Competitive)

Night types determine the difficulty level and rules of the game. The following night types are available:

- Casual: Designed for casual play, with reduced complexity and easier objectives.
- Community: Balanced between complexity and accessibility, suitable for most players.
- Competitive: Highly challenging with complex objectives and strict rules, intended for experienced players.

### Capture Modes (No-Gear/Lite/Pro)

Capture modes determine the equipment available during gameplay. The following capture modes are available:

- No-Gear: Players start with no gear or resources.
- Lite: Players start with basic gear and resources.
- Pro: Players start with advanced gear and resources.

### Host OS 4 Operations

Host OS 4 offers four essential operations to manage game sessions:

1. Start Clean: Reset the game environment, removing any saved data or configurations.
2. Call Moments: Pause the game and allow players to discuss strategies or take breaks.
3. Debrief on Rails: Analyze game data and player performance after each session.
4. Lock Next Session: Prevent unauthorized access or modifications to the next game session.

## Edge Cases

- If you encounter issues during setup, consult the [PZOD troubleshooting guide](https://github.com/PointZeroOneDigital/pzo_host_os_kit_v1/blob/main/TROUBLESHOOTING.md).
- For advanced customization options, refer to the [PZOD configuration guide](https://github.com/PointZeroOneDigital/pzo_host_os_kit_v1/blob/main/CONFIGURATION.md).
