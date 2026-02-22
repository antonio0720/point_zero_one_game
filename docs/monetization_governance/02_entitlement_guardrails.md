# Entitlement Guardrails for Point Zero One Digital

This document outlines the entitlement guard layer rules and specifications for Point Zero One Digital's financial roguelike game. The goal is to ensure a secure, deterministic, and user-friendly monetization system.

## Overview

The entitlement guard layer consists of three main components: scopes, influence surface constraints, and fail-closed behavior by mode (solo casual vs verified ladder). These rules govern access to in-game content based on the player's account status and game mode.

## Non-negotiables

1. **Strict Scope Management**: Each scope represents a specific set of resources or features that can be accessed by the user. The system must enforce strict adherence to these scopes to prevent unauthorized access.
2. **Influence Surface Constraints**: Limit the impact of any potential exploits on the game's economy and player experience by restricting the influence a single user or account can have within the game.
3. **Fail-Closed Behavior**: In case of any errors or unexpected conditions, the system should default to denying access rather than granting it unintentionally.

## Implementation Spec

### Scopes

Scopes are defined as a list of resources or features that can be accessed by a user based on their account status and game mode. The scope for each user is determined at login and updated as the user progresses through the game or makes purchases.

#### Example Scope:
```json
{
  "user_id": "123456",
  "game_mode": "solo_casual",
  "resources": ["currency", "premium_content"],
  "features": ["double_rewards"]
}
```

### Influence Surface Constraints

To limit the impact of any potential exploits, the system should enforce constraints on the actions a single user can take within the game. This includes, but is not limited to:

1. **Resource Transactions**: Limit the number and frequency of resource transactions (e.g., purchases, rewards) per user account.
2. **In-game Actions**: Restrict the number of in-game actions a single user can perform within a given timeframe (e.g., battles, trades).
3. **User Interaction**: Limit the number and frequency of interactions between users (e.g., friend requests, messages).

### Fail-Closed Behavior

In case of any errors or unexpected conditions, the system should default to denying access rather than granting it unintentionally. This includes:

1. **Error Handling**: Implement robust error handling mechanisms to prevent unauthorized access in case of unexpected conditions.
2. **Input Validation**: Validate all user input thoroughly to ensure it adheres to the defined scopes and constraints.
3. **Logging and Monitoring**: Log all relevant events for analysis and potential future adjustments to the entitlement guardrails.

## Edge Cases

### Account Sharing

In cases where multiple users share a single account, the system should enforce stricter resource and action limits to prevent one user from exploiting the shared account for unintended benefits.

### Premium Content Purchases

When a user purchases premium content, the system should update their scope immediately to reflect the new resources or features they have access to. If the purchase fails for any reason, the system should default to denying access rather than granting it unintentionally.
