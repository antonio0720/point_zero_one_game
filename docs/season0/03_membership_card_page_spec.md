# Membership Card Page Specification

## Overview

The Membership Card page is a key component of the Point Zero One Digital platform, providing users with an overview of their membership status, rewards, and progress. The page will display information such as tier, join date, streak, referrals, proof gallery, and countdown.

## Non-negotiables

1. **Tier**: Clearly display the user's current membership tier.
2. **Join Date**: Show the date the user joined Point Zero One Digital.
3. **Streak**: Display the user's current streak (if applicable).
4. **Referrals**: Show the number of successful referrals made by the user.
5. **Proof Gallery**: Provide a gallery of proofs related to the user's achievements or milestones.
6. **Countdown**: If applicable, show a countdown for upcoming rewards or events.
7. **Navigation Placement**: Ensure navigation elements are consistently placed and easily accessible.

## Implementation Spec

1. **Tier**: Use TypeScript strict mode to define the tier enum with clear values (e.g., `BRONZE`, `SILVER`, `GOLD`). Display the tier in a prominent, easy-to-read format.
2. **Join Date**: Format the join date using ISO 8601 standard for consistency and compatibility.
3. **Streak**: If applicable, display the streak count with clear visual indicators to show progress towards rewards or benefits.
4. **Referrals**: Display the number of successful referrals made by the user in a prominent location. Consider using a progress bar or similar visual aid to show progress towards rewards or benefits.
5. **Proof Gallery**: Implement a responsive, user-friendly gallery for displaying proofs related to the user's achievements or milestones. Ensure that images are optimized for fast loading and display.
6. **Countdown**: If applicable, use a clear, easy-to-read countdown timer for upcoming rewards or events. Consider using a progress bar or similar visual aid to show time remaining.
7. **Navigation Placement**: Place navigation elements consistently across all pages, ensuring they are easily accessible and intuitive to use.

## Edge Cases

1. **Tier Changes**: Implement logic to handle tier changes, updating the displayed tier accordingly.
2. **Streak Breaks**: If a user's streak is broken (e.g., due to inactivity), update the displayed streak count and any associated rewards or benefits.
3. **Referral Updates**: Handle updates to referrals, such as successful referrals or cancellations, and update the displayed count accordingly.
4. **Proof Gallery Updates**: Implement logic to handle additions, removals, or updates to proofs in the gallery.
5. **Countdown Expiration**: Handle countdown expirations gracefully, updating the displayed countdown (if applicable) or providing a clear message about the expired event.
6. **Navigation Changes**: If navigation elements are updated or reorganized, ensure that all pages are updated accordingly to maintain consistency and ease of use.
