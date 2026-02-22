# Point Zero One Digital - Captions Guide

## Overview

This guide outlines the usage of `captions.csv`, detailing the moment code lookup, template fill process, and providing examples for each moment family. Additionally, it includes platform-specific length notes for TikTok, Instagram, and YouTube.

## Non-negotiables

1. Strict TypeScript mode: All code adheres to strict-mode standards.
2. No usage of 'any': TypeScript types should be explicitly defined.
3. Deterministic effects: All game events are predictable and reproducible.
4. Consistent formatting: Follow the Point Zero One Digital coding style guide.

## Implementation Spec

### Moment Code Lookup

Each moment in `captions.csv` is identified by a unique code, which corresponds to a predefined caption template and associated data. The code can be found in the first column of the csv file.

### Template Fill Guide

Templates are defined in the second column of `captions.csv`. They consist of placeholders for dynamic content, such as player stats or game events. Replace these placeholders with the appropriate data to generate the final caption.

### Example Filled Captions

#### Victory Moment Family (V)

| Code | Template                     | Filled Caption                      |
|------|------------------------------|------------------------------------|
| V1   | Player {player_name} has won! | Player John Doe has won!            |
| V2   | You defeated {enemy_name}    | You defeated Goblin King           |
| V3   | Congratulations, {player_name}! | Congratulations, John Doe!         |

#### Defeat Moment Family (D)

| Code | Template                     | Filled Caption                      |
|------|------------------------------|------------------------------------|
| D1   | Player {player_name} has lost. | Player John Doe has lost.           |
| D2   | Game over for {player_name}.  | Game over for John Doe.            |
| D3   | Better luck next time, {player_name}. | Better luck next time, John Doe.    |

### Platform-Specific Length Notes

#### TikTok (Maximum length: 60 characters)

Ensure captions are concise and to the point to fit within TikTok's character limit.

#### Instagram (Maximum length: 2200 characters)

Instagram allows for longer captions, but it is still recommended to keep them engaging and easy to read.

#### YouTube (No character limit)

YouTube does not have a character limit, allowing for more detailed and informative captions. However, consider keeping them concise for optimal engagement.
