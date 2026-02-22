# PVP Ladders UX Flows and Copy

## Overview

This document outlines the user experience (UX) flows and copy guidelines for Point Zero One Digital's 12-minute financial roguelike game, focusing on the new player, early verified click, verified submit, and fail verification stages. The goal is to provide a clear, concise, and non-accusatory user experience that aligns with our strict-mode TypeScript codebase and deterministic effects.

## Non-negotiables

1. Strict adherence to the Point Zero One Digital style guide for consistent UX across all platforms.
2. Use of precise, execution-grade language in all copy.
3. Avoidance of fluff and bureaucratic jargon.
4. Implementation of a user-friendly design that is easy to understand and navigate.
5. Ensuring the UX flows are deterministic, mirroring our production-grade, deployment-ready infrastructure.

## Implementation Spec

### New Player

1. Welcome screen: Greet the player with a warm welcome message, providing an overview of the game and its objectives.
2. Tutorial: Guide the new player through a brief tutorial, teaching them the basics of gameplay and controls.
3. Initial Verification: Request the player to verify their account by entering a verification code sent to their email or phone number.
4. Game Introduction: Once verified, introduce the player to the game world, providing a brief overview of the current state and objectives for the session.

### Early Verified Click

1. Dashboard: Upon successful verification, present the player with a dashboard displaying their current status, progress, and available options.
2. Gameplay: Allow the player to engage in gameplay, making strategic decisions and managing resources.
3. Notifications: Display notifications for important events, such as updates on the player's position in the PVP ladder or new opportunities for resource acquisition.
4. Verification Reminder: Periodically remind the player to verify their account if they have not done so already, ensuring continued access to game features and progress.

### Verified Submit

1. Submission Screen: Present the player with a submission screen when they complete a session or reach a significant milestone.
2. Results Summary: Display a summary of the player's results, including their score, rank, and any rewards earned.
3. Feedback: Provide constructive feedback on the player's performance, offering tips for improvement and encouraging them to continue playing.
4. Verification Confirmation: Confirm that the player's submission has been successfully recorded and processed.

### Fail Verification

1. Error Screen: Display an error screen when a verification attempt fails, providing a clear explanation of the issue and suggesting possible solutions.
2. Retry Option: Offer the player the option to retry the verification process or seek assistance if they are unable to resolve the issue on their own.
3. Account Lockout: Implement a temporary account lockout mechanism after multiple failed verification attempts, with instructions for resetting the password or contacting support for help.
4. Notifications: Send notifications to the player regarding the status of their verification attempt and any necessary actions they need to take to regain access to the game.

## Edge Cases

1. Internet connectivity issues: Provide offline mode functionality, allowing players to continue playing without an internet connection until they can reconnect and verify their account.
2. Account recovery: Implement a secure account recovery process for players who have lost access to their accounts due to forgotten passwords or other issues.
3. Multi-device support: Allow players to access their accounts from multiple devices, syncing progress and game data across all platforms.
