Identity Model Documentation for Point Zero One Digital's Sovereign Infrastructure
===============================================================================

Overview
--------

The identity model in our financial roguelike game is designed to provide a secure and scalable user management system. The model consists of three tiers: guest, email/phone bound, and platform linked. Each tier represents an increasing level of trust and access within the game.

Non-Negotiables
---------------

1. **TypeScript**: All code adheres to strict TypeScript mode, ensuring type safety and readability.
2. **Deterministic Effects**: All effects are deterministic, ensuring fairness and reproducibility.
3. **No 'any'**: The use of the `any` type is strictly prohibited to maintain type safety.
4. **GDPR/CCPA Compliance**: A deletion path is provided for users who wish to delete their data in accordance with GDPR and CCPA regulations.

Implementation Spec
--------------------

### Guest Tier

Guests have minimal access to the game, allowing them to browse public areas without authentication. No personal data is associated with a guest account.

### Email/Phone Bound Tier

Users who register with an email or phone number gain access to additional features and increased trust within the system. Personal data associated with these accounts must be verified before use.

### Platform Linked Tier

Platform-linked users have the highest level of trust, allowing them access to all game features. These accounts are linked to a specific platform (e.g., Steam, Epic Games Store) and require additional verification steps to ensure account security.

Device Trust Impact on Eligibility
----------------------------------

The device used by a user can impact their eligibility for certain features or actions within the game. For example, devices with a history of suspicious activity may be temporarily locked out or subjected to increased verification requirements.

Edge Cases
----------

1. **Account Recovery**: In the event of a lost or forgotten password, users can recover their account using alternative methods such as email or phone verification.
2. **Data Deletion**: Users have the right to request the deletion of their personal data in accordance with GDPR and CCPA regulations. This process will permanently delete the user's account and associated data.
3. **Suspicious Activity**: The system should be able to detect and respond to suspicious activity, such as multiple failed login attempts or unusual account behavior. In these cases, additional verification may be required before granting access.
