# Invite System, Rewards, and Anti-Spam Rules

## Overview

This document outlines the design for the invite system, cosmetic reward structure, anti-spam rules, and viral loop in Point Zero One Digital's financial roguelike game. The focus is on a production-grade, deployment-ready solution that adheres to strict TypeScript standards and ensures deterministic effects.

## Non-Negotiables

1. **Invite System**: Three types of invites: direct (friend-to-friend), referral (chain-based), and public (open to all).
2. **Cosmetic Rewards Structure**: Tiered rewards based on the number of successful invitations.
3. **Anti-Spam Rules**: Cooldown periods, maximum invite limits, suppression for excessive spamming, and completion requirements to prevent abuse.
4. **Viral Loop Design**: Encourage organic growth through incentivized invites and engaging user experience.

## Implementation Spec

### Invite System

#### Direct Invite
- Players can invite friends directly via email or social media platforms.
- Each direct invitation grants the sender a cosmetic reward upon the recipient's successful registration.

#### Referral Invite
- Players receive unique referral codes upon registration.
- New players who register using a referral code grant both the referrer and the referee cosmetic rewards.
- The chain continues, with each new player receiving their own unique referral code to share.

#### Public Invite
- Players can participate in public events or promotions that offer cosmetic rewards for successful registrations.
- No unique codes are required; players simply enter a provided code during registration.

### Cosmetic Reward Structure

- Tiered rewards based on the number of successful invitations: Bronze (1-5 invites), Silver (6-10 invites), Gold (11+ invites).
- Each tier offers progressively more valuable cosmetic items, such as unique avatars, emotes, or skins.

### Anti-Spam Rules

#### Cooldown Periods
- A cooldown period is enforced after each successful invitation to prevent rapid spamming.
- The length of the cooldown period increases with each subsequent invite, encouraging players to spread invites over time.

#### Max Invite Limits
- Players are limited to a maximum number of invitations per day or week to prevent excessive spamming.

#### Suppression
- Players who exceed the maximum invite limit or engage in abusive behavior will be temporarily suppressed from sending invites.

#### Completion Requirements
- Players must complete certain in-game milestones before being eligible to send invitations, discouraging players from spamming invites immediately upon registration.

## Edge Cases

### Duplicate Invite Codes
- In the event of duplicate invite codes, the first player to register with a valid code will receive credit for the invitation.

### Expired Invite Codes
- If an invite code is not used within a specified timeframe, it will expire and no longer be valid for redemption.
