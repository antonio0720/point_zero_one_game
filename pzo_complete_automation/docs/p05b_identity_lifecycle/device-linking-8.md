Title: Identity Lifecycle and Recovery - Device Linking v8

## Overview

This document outlines the identity lifecycle and recovery process for version 8 of our Device Linking feature.

## Key Concepts

- **Identity**: A unique representation of a user across multiple devices.
- **Device Linking**: The process by which a user links their account to one or more devices.
- **Link Code**: A temporary code generated for device linking or recovery purposes.
- **Recovery**: The process by which a user regains access to their account on a linked device after losing access.

## Identity Lifecycle Stages

1. **Creation**: During signup, the user creates an identity and may choose to link one or more devices immediately.
2. **Linking**: A new device can be linked to the identity by entering a link code sent via email or SMS.
3. **Primary Device**: The first device linked is designated as the primary device, which stores the most up-to-date information about the user's account.
4. **Secondary Devices**: Additional devices linked are considered secondary and sync data with the primary device.
5. **Unlinking**: A device can be unlinked from the identity at any time, either by the user or automatically if the device is inactive for an extended period.
6. **Re-Linking**: After unlinking, a device can be re-linked using the same process as initially linking it.
7. **Recovery**: If a user loses access to their primary device, they can recover their account by linking another device and verifying their identity through email or SMS.

## Recovery Process

1. User requests recovery on a secondary device or a new device.
2. System generates a temporary link code and sends it to the user via email or SMS.
3. User enters the link code on the requesting device to initiate the recovery process.
4. System prompts the user for additional verification, such as answering security questions or confirming their email address.
5. Once verified, the requesting device becomes the new primary device, and data syncs with it.
6. The old primary device is unlinked from the identity.
