# Credential Hooks, Challenge Hooks, Identity Hooks, and Viral Hooks for TikTok/Reels/Shorts Formats

## Overview

This document outlines the implementation of credential hooks, challenge hooks, identity hooks, and the creation of 10 new viral hooks specifically designed for TikTok, Reels, and Shorts formats within the `pzo_season0_founding_era_waitlist_engine_v1` project.

## Non-Negotiables

- All code adheres to strict TypeScript mode and avoids using 'any'.
- All effects are deterministic.
- The hooks are designed for production-grade, deployment-ready infrastructure.

## Implementation Spec

### Credential Hooks

Credential hooks enable users to authenticate and authorize their accounts within the game.

1. `login_with_email`: Users can log in using their email addresses and passwords.
2. `login_with_social_media`: Users can link their social media accounts (Facebook, Google, etc.) to authenticate and play the game.
3. `forgot_password`: A mechanism for users to recover their forgotten passwords.
4. `two_factor_authentication`: An optional layer of security that requires users to verify their identity via a second factor (SMS code, authenticator app, etc.).

### Challenge Hooks

Challenge hooks present users with tasks or puzzles to complete as part of the gameplay experience.

1. `daily_challenge`: A daily challenge that rewards players with in-game currency or items upon completion.
2. `weekly_challenge`: A weekly challenge offering more substantial rewards than the daily challenges.
3. `seasonal_challenge`: Seasonal challenges with unique themes and prizes to engage players over extended periods.
4. `community_challenge`: Challenges that require collaboration between multiple players, fostering a sense of community within the game.

### Identity Hooks

Identity hooks allow users to customize their in-game characters and express themselves.

1. `character_customization`: Users can modify their character's appearance, including clothing, accessories, and cosmetic items.
2. `name_change`: A mechanism for users to change their in-game names if desired.
3. `profile_picture_upload`: Users can upload a profile picture to represent themselves within the game.
4. `achievement_display`: Displays a user's achievements and progress within the game, encouraging competition and self-expression.

### Viral Hooks for TikTok/Reels/Shorts Formats

These hooks are designed to create shareable content that encourages users to engage with the game on popular social media platforms.

1. `share_victory`: Users can share their victories or significant achievements within the game on TikTok, Reels, or Shorts.
2. `challenge_friends`: Users can challenge friends to complete specific tasks or puzzles within the game and share their attempts on social media.
3. `dance_off`: A mini-game where users can compete in dance-offs and share their performances on TikTok, Reels, or Shorts.
4. `meme_generator`: A tool that allows users to create custom memes using in-game assets and share them on social media platforms.
5. `reaction_recording`: Users can record their reactions to in-game events and share them on TikTok, Reels, or Shorts.
6. `influencer_challenge`: Collaborations with popular influencers who create exclusive challenges for the game community, encouraging user engagement and social sharing.
7. `community_hashtag_challenge`: Users can participate in community-driven hashtag challenges, fostering a sense of camaraderie and competition among players.
8. `tutorial_sharing`: Users can share tutorials or tips for playing the game on TikTok, Reels, or Shorts, helping newcomers to learn and engage more effectively.
9. `in-game_event_announcement`: Announcing in-game events (such as new seasons, updates, or collaborations) on social media platforms to keep the community informed and engaged.
10. `community_spotlight`: Highlighting exceptional players or creative content within the game community on TikTok, Reels, or Shorts, encouraging further engagement and user-generated content.
