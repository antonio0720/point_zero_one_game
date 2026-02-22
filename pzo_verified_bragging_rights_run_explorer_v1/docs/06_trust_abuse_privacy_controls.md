# Trust Abuse Privacy Controls in pzo_verified_bragging_rights_run_explorer_v1

This document outlines the privacy controls and abuse prevention measures implemented in `pzo_verified_bragging_rights_run_explorer_v1`.

## Overview

The following sections detail the key privacy controls, including rate limiting, visibility modes, quarantined messaging rules, owner controls, and CDN caching by status. These measures are designed to ensure a secure and private user experience while maintaining the game's deterministic nature.

## Non-negotiables

1. **Rate Limiting**: To prevent brute force attacks and excessive resource consumption, we implement rate limiting on various user actions such as login attempts, API calls, and message sending.
2. **Visibility Modes**: Users have the option to set their content visibility to Public, Unlisted, or Private. Public content is accessible by everyone, Unlisted content is only accessible via direct link, while Private content requires explicit permission for access.
3. **Quarantined Messaging Rules**: To minimize the potential help given to attackers, we have quarantine rules in place for messages containing suspicious content or patterns. These messages are automatically isolated and reviewed by our moderation team before being made available again.
4. **Owner Controls**: Users maintain full control over their content, including the ability to delete, edit, or restrict access at any time.
5. **CDN Caching by Status**: Content is cached on a Content Delivery Network (CDN) based on its visibility status. Public and Unlisted content are cached for performance reasons, while Private content remains uncached to maintain privacy.

## Implementation Spec

Rate limiting is implemented using TypeScript's built-in `Map` data structure to store user actions and their corresponding timestamps. The elapsed time between actions is compared against a predefined rate limit threshold. If the threshold is exceeded, the user is temporarily blocked from performing further actions of that type.

Visibility modes are managed using a combination of database fields and URL parameters. When a user sets their content visibility, the corresponding field in the database is updated, and the URL structure adjusts accordingly to reflect the new visibility setting.

Quarantined messaging rules are implemented using a custom algorithm that analyzes messages for suspicious content or patterns. Messages flagged as potentially harmful are automatically isolated and reviewed by our moderation team before being made available again.

Owner controls are provided through an intuitive user interface, allowing users to easily manage their content and access settings.

CDN caching is managed using standard HTTP headers, with Public and Unlisted content cached for a predefined period to improve performance while maintaining privacy for Private content.

## Edge Cases

1. **Rate Limiting**: In the event of a Distributed Denial of Service (DDoS) attack, additional measures such as IP blocking or CAPTCHA challenges may be implemented temporarily to prevent excessive resource consumption and maintain service availability.
2. **Visibility Modes**: If a user accidentally sets their content to Private and forgets to share the access link, they can request a temporary public link from our support team for easy sharing.
3. **Quarantined Messaging Rules**: In rare cases where a legitimate message is incorrectly flagged as suspicious, users can appeal the decision through our moderation system, allowing their message to be reviewed and potentially released.
4. **Owner Controls**: In the event of a lost or compromised account, users can follow our account recovery process to regain access to their content and settings.
5. **CDN Caching by Status**: If a user sets their previously public content to Private, the CDN will purge the cached version of that content to ensure privacy is maintained.
