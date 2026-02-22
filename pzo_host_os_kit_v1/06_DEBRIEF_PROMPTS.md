# Point Zero One Digital Debrief Prompts v1.0

This document outlines the debrief prompts for the game "Point Zero One Digital". The prompts are designed to provide a structured and concise format for post-game analysis, discussion, and feedback.

## Overview

The debrief prompts are divided into several categories: Core 3 Prompts, Reveal Prompts, Group Prompts, Hook-the-next-night Prompts, Competitive Night Debrief Set, and Community Story Block Prompts. Each category serves a specific purpose in the game's narrative and gameplay mechanics.

## Non-negotiables

1. Precise language: Use execution-grade, anti-bureaucratic language to ensure clarity and efficiency.
2. Strict TypeScript: Never use 'any' in TypeScript. All code is strict-mode.
3. Deterministic effects: All game effects are designed to be deterministic for fairness and reproducibility.
4. Markdown format: All prompts are written in Markdown for easy readability and formatting.

## Implementation Spec

### Core 3 Prompts

These prompts are presented at the end of each game round (every three minutes). They focus on the player's current financial status, infrastructure, and strategic decisions.

```markdown
**Core 3 Prompts:**

1. **Financial Status:**
   - Current assets: ${assets}
   - Current liabilities: ${liabilities}
   - Net worth: ${netWorth}

2. **Infrastructure Overview:**
   - Current infrastructure level: ${infrastructureLevel}
   - Upgrade cost: ${upgradeCost}
   - Infrastructure upgrade progress: ${progress}%

3. **Strategic Decisions:**
   - Remaining investment points: ${investmentPoints}
   - Available investment options: ${options}
```

### Reveal Prompts

These prompts are used to reveal hidden information, such as the identity of a rival or the location of a valuable asset.

```markdown
**Reveal Prompts:**

1. **Rival Identity:**
   - Rival name: ${rivalName}
   - Rival infrastructure level: ${rivalInfrastructureLevel}
   - Rival net worth: ${rivalNetWorth}

2. **Asset Location:**
   - Asset location: ${location}
```

### Group Prompts

These prompts are used during multiplayer sessions to facilitate communication and collaboration among players.

```markdown
**Group Prompts:**

1. **Group Chat:**
   - Message from ${sender}: ${message}

2. **Vote on Strategy:**
   - Proposed strategy: ${strategy}
   - Voting options: ${options}
   - Your vote: ${vote}
```

### Hook-the-next-night Prompts

These prompts are used to create suspense and anticipation for the next game night.

```markdown
**Hook-the-next-night Prompts:**

1. **Teaser:**
   - Teaser message: ${teaserMessage}

2. **Countdown:**
   - Remaining time until the next game night: ${time} minutes
```

### Competitive Night Debrief Set

These prompts are used during competitive nights to provide a detailed analysis of each player's performance.

```markdown
**Competitive Night Debrief Set:**

1. **Player Performance Summary:**
   - Player name: ${playerName}
   - Final assets: ${finalAssets}
   - Final liabilities: ${finalLiabilities}
   - Net worth change: ${netWorthChange}
   - Infrastructure level change: ${infrastructureLevelChange}

2. **Player Comparison:**
   - Player comparison chart (optional)
```

### Community Story Block Prompts

These prompts are used to engage the community and encourage storytelling and discussion.

```markdown
**Community Story Block Prompts:**

1. **Share Your Experience:**
   - Question or prompt for players to share their experiences, strategies, or insights.

2. **Vote on Next Event:**
   - Proposed event: ${event}
   - Voting options: ${options}
```

## Edge Cases

1. In case of a tie during voting, the game should randomly select one of the tied players as the winner.
2. If a player's net worth becomes negative, they are considered bankrupt and eliminated from the game.
3. If a player fails to make an investment decision within the given time limit, their remaining investment points are automatically distributed among available options.
