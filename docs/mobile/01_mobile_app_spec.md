# Mobile App Spec (iOS & Android)

## Overview

This document outlines the specifications for the mobile app development of Point Zero One Digital's 12-minute financial roguelike game. The app will be built using React Native, sharing game logic with the web version via a shared/contracts directory. The mobile app will also include platform-specific features such as push notifications, device trust attestation, biometric access, and camera for card scan. Offline solo run support is also required.

## Non-Negotiables

1. **TypeScript**: All code must be written in TypeScript using strict mode to ensure type safety and avoid runtime errors.
2. **Deterministic Effects**: All effects in the game must be deterministic to ensure fairness and reproducibility.
3. **No 'any'**: The use of 'any' is strictly prohibited in TypeScript to maintain type safety.
4. **Offline Support**: The app must support offline solo runs for uninterrupted gameplay when internet connectivity is not available.

## Implementation Spec

### Shared Game Logic

The mobile app will share game logic with the web version via a shared/contracts directory. This ensures consistency across platforms and simplifies development by reducing code duplication.

### Platform-Specific Features

#### Push Notifications

Push notifications will be implemented for both iOS and Android to keep users updated on game events, promotions, and other important information.

#### Device Trust Attestation

Device trust attestation will be implemented to verify the integrity of the device running the app. This is crucial for securing sensitive user data and maintaining the integrity of the game.

#### Biometric Access

Biometric access (fingerprint or facial recognition) will be implemented to secure the app and prevent unauthorized access.

#### Camera for Card Scan

A camera feature will be added to allow users to scan their cards for quick and easy setup.

### Offline Solo Run Support

The app must support offline solo runs, allowing users to play the game without an internet connection. This includes storing game data locally and syncing it with the server when connectivity is restored.

## Edge Cases

1. **Device Compatibility**: The app must be compatible with a wide range of devices to ensure accessibility for as many users as possible.
2. **Operating System Updates**: The app must be designed to handle operating system updates without affecting the user experience or game functionality.
3. **Network Connectivity**: The app must handle various network connectivity scenarios, including intermittent connectivity and slow networks, to ensure a seamless user experience.
