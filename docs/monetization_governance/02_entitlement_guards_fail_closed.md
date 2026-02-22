# Entitlement Guards Fail Closed Policy

This document outlines the policy for entitlement guards in Point Zero One Digital's financial roguelike game.

## Overview

The entitlement guard policy is designed to manage access to ranked contexts within the game. It ensures that players who mis-tag or lack necessary tags can still purchase an entitlement, but are restricted from participating in ranked matches until they acquire the correct tag. Ladders validate entitlements to enforce this policy.

## Non-negotiables

1. Strict TypeScript coding standards are enforced, with 'any' being prohibited. All code is written in strict mode.
2. All effects are deterministic to maintain fairness and reproducibility.
3. The policy follows a fail-closed approach, meaning that if an entitlement guard fails (i.e., the player lacks the necessary tag), the purchase will still be processed but the player will be restricted from ranked contexts.

## Implementation Spec

1. Upon purchasing an entitlement, the game checks for the presence and correctness of required tags. If a mis-tag or missing tag is detected, the purchase is allowed to proceed, but the player is marked as ineligible for ranked matches.
2. Ladders are responsible for validating entitlements during matchmaking. Players without the necessary tags will be excluded from ranked contexts.
3. The game maintains a record of each player's entitlement status and tag information, which is updated upon purchase or tag acquisition.

## Edge Cases

1. If a player purchases an entitlement with the correct tag but later loses it due to a bug or other issue, they will remain eligible for ranked matches as long as they regain the tag before participating in a ranked context.
2. Players who purchase an entitlement without the necessary tag can still participate in unranked matches and practice sessions. However, they must acquire the correct tag to gain access to ranked matches.
