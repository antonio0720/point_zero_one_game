# Verification Ritual UX Flows

## Overview

This document outlines the user experience (UX) flows for the after-run verification process in Point Zero One Digital's 12-minute financial roguelike game. The focus is on transitioning from a pending state to a verified state, notifications, share flows, and ritual enforcement rules such as leaderboards and showcases.

## Non-Negotiables

1. Clarity: All UX elements should be self-explanatory and intuitive for players of all skill levels.
2. Efficiency: The process should be quick and seamless to minimize player frustration and maximize engagement.
3. Determinism: All effects, including notifications and ritual enforcement rules, must be deterministic to maintain fairness and trust.
4. Strict TypeScript: Adherence to strict TypeScript coding practices ensures robustness and maintainability of the codebase.

## Implementation Spec

### Pending State to Verified State Transition

1. Upon completion of a run, the game will display a "Verification in Progress" screen.
2. The game will send a verification request to the server, including relevant data from the run.
3. The server will process the request and respond with either a success or failure status.
4. If successful, the player's state will be updated to verified, and they will be notified of their new status.
5. If unsuccessful, the player will be informed of any errors and given the option to retry or seek assistance.

### Notifications

1. Successful verification: A pop-up notification will appear, congratulating the player on a successful run and providing relevant details (e.g., score, rank).
2. Failed verification: A pop-up notification will appear, informing the player of the failure and offering guidance for improvement or troubleshooting steps.
3. Leaderboard updates: Players will be notified when their position on the leaderboard changes significantly.
4. Showcase events: Players will receive notifications for notable achievements (e.g., breaking a record, reaching a milestone).

### Share Flows

1. Players can share their scores and achievements on social media platforms directly from the game.
2. The game will provide pre-populated messages and images for easy sharing.
3. Players can also invite friends to join the game via email or social media invitations.

### Ritual Enforcement Rules

1. Leaderboards: A real-time, publicly visible leaderboard will showcase top performers, fostering competition and encouraging continuous improvement.
2. Showcases: Periodic showcases of notable achievements (e.g., highest score, fastest time) will be featured on the game's official channels to celebrate player successes.

## Edge Cases

1. Internet connectivity issues: The game should handle temporary internet disruptions gracefully, allowing players to resume their runs once connectivity is restored.
2. Server overload: In the event of server overload, the game should implement queueing mechanisms to ensure fairness and prevent player frustration.
3. Cheating detection: The game should employ robust cheat detection mechanisms to maintain the integrity of the leaderboards and showcases. Players found cheating may face penalties, such as temporary or permanent bans.
