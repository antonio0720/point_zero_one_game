# Point Zero One Challenge Mechanics - Viral Challenge

This document outlines the mechanics for the viral challenge feature in Point Zero One Digital's financial roguelike game.

## Overview

The viral challenge mechanism encourages players to invite friends to join the game, fostering a sense of community and competition. The challenge follows a specific format: 5 friends, $20 buy-in.

## Non-negotiables

1. **Friend Invitation**: Players can invite up to 5 friends to join the game.
2. **Buy-In**: Each friend must contribute a $20 buy-in to participate in the challenge.
3. **Tag System**: Each player is assigned a unique tag for identification within the game.
4. **Stitching Mechanics**: Players' accounts are stitched together, allowing for shared game progress and competition.
5. **Account Aggregator Hooks**: The system utilizes account aggregator hooks to gather data from various financial platforms.
6. **Weekly Trend Injection**: To maintain game balance and unpredictability, weekly trend injections may occur.

## Implementation Spec

1. **Friend Invitation**: Implement a user-friendly interface for inviting friends via email or social media. Ensure data privacy and security measures are in place.
2. **Buy-In**: Create a secure payment gateway for friends to contribute their buy-in amount.
3. **Tag System**: Assign each player a unique tag upon registration, ensuring no duplicates.
4. **Stitching Mechanics**: Develop a system that links players' accounts together, allowing for shared game progress and competition.
5. **Account Aggregator Hooks**: Integrate account aggregator APIs to gather financial data from various platforms.
6. **Weekly Trend Injection**: Implement a mechanism for injecting unpredictable market trends into the game on a weekly basis.

## Edge Cases

1. **Friend Invitation Limit Exceeded**: If a player attempts to invite more than 5 friends, display an error message and prevent further invitations.
2. **Insufficient Buy-In**: If a friend does not contribute the required $20 buy-in, prevent them from joining the challenge and notify the player who invited them.
3. **Duplicate Tags**: In case of duplicate tags during registration, generate a new unique tag for the affected player.
4. **Account Linking Issues**: If issues arise with account linking or stitching, provide clear error messages and offer troubleshooting guidance to players.
5. **Weekly Trend Injection Errors**: If an error occurs during weekly trend injection, log the issue for further investigation and ensure game continuity.
