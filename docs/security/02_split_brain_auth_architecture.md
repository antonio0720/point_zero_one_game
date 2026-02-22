# Split-Brain Auth Architecture

This document outlines the security measures implemented in Point Zero One Digital's financial roguelike game to ensure a secure and deterministic environment.

## Overview

The Split-Brain Auth Architecture separates the game simulation service from direct write access to economy and identity data. This separation ensures that no single component has control over both the game state and sensitive user information.

## Non-Negotiables

1. **Separate AuthZ Contexts**: The game simulation service, economy, and identity services operate in distinct authentication contexts. This prevents unauthorized access between services.
2. **API Gateway Enforcement**: All communication between services is routed through an API gateway that enforces access control policies.
3. **No Prompt Injection Vector into Card DSL from User Input**: The Card DSL (Domain Specific Language) used to define game cards does not allow for user input injection vectors, preventing potential security threats.

## Implementation Spec

1. **Game Simulation Service**: This service is responsible for managing the game state and player interactions. It has read access to economy and identity data but cannot write directly to these services. All writes are routed through the API gateway.
2. **Economy Service**: This service manages all financial transactions within the game. It does not allow direct access from the game simulation service or any other component.
3. **Identity Service**: This service manages user accounts and authentication. It does not allow direct access from the game simulation service or any other component.
4. **API Gateway**: This component enforces access control policies, routing requests between services based on their authentication contexts. It also handles all writes to the economy and identity services.

## Edge Cases

1. **Service Failure**: In case of service failure, the API gateway is designed to maintain a consistent game state by enforcing read-after-write consistency rules. This ensures that the game simulation service always has access to the most up-to-date data, even in the event of temporary service outages.
2. **Distributed Denial of Service (DDOS) Attacks**: The API gateway is designed to withstand DDOS attacks by implementing rate limiting and traffic shaping mechanisms. These measures help prevent the game from being overwhelmed by malicious traffic.
