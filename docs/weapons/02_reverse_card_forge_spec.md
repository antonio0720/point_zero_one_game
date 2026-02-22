# Reverse Card Forge Spec

## Overview

The `Reverse Card Forge` is a game mechanic in Point Zero One Digital's 12-minute financial roguelike game. It allows players to design their own unique cards, which can significantly impact the game's outcome.

## Non-negotiables

1. Upon death, the player is directed to the 'Design Your FUBAR' screen.
2. Natural Language Processing (NLP) is used to convert user input into a Card Description Language (CDL).
3. The community votes on the design via a gauntlet system: Too Brutal/Just Right/Too Soft.
4. The top 10% of designs are minted into the season deck.
5. A 0.5% royalty is collected per game played using the designed card.

## Implementation Spec

### Design Your FUBAR Screen

Upon death, the player is presented with a customizable interface to design their new card. This includes a text box for card description, stat allocation, and visual customization options.

### Card Description Language (CDL) Generation

NLP processes the user's input from the Design Your FUBAR screen and converts it into a CDL format that can be understood by the game engine. This ensures consistency in card design and allows for easier integration of community-designed cards.

### Community Gauntlet Voting

The community votes on each new card design through a gauntlet system, where players can rate the design as Too Brutal, Just Right, or Too Soft. The ratings are used to determine the overall popularity and balance of the card design.

### Top 10% Minting

The top 10% of designs, as determined by community voting, are minted into the season deck. These cards can then be obtained through gameplay or purchased using in-game currency.

### Royalty Collection

A 0.5% royalty is collected per game played using a designed card. This revenue is distributed to the original designer of the card as an incentive for creative and balanced design contributions.

## Edge Cases

1. In case of a tie in community voting, the design with the most unique votes will be prioritized.
2. If a player designs a card that significantly imbalances the game, it may be temporarily or permanently banned until adjustments can be made to ensure fair gameplay.
3. In the event of a technical issue preventing the minting of a top 10% design, an alternative method for distribution (e.g., direct reward) will be implemented.
