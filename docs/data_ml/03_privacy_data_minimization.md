# Data Minimization Rules for Point Zero One Digital

## Overview

This document outlines the data minimization rules for Point Zero One Digital's game and infrastructure. The focus is on collecting only necessary data, maintaining retention schedules, implementing a GDPR deletion pipeline, and anonymizing data before analytics export.

## Non-negotiables

1. **Data Collection**: Collect minimal data required to provide the service and improve user experience. Avoid collecting sensitive or unnecessary data.
2. **Retention Schedules**: Implement retention schedules for different types of data to ensure their timely deletion.
3. **GDPR Deletion Pipeline**: Develop a pipeline that adheres to GDPR regulations, allowing users to request the deletion of their data.
4. **Anonymization**: Anonymize all data before exporting it for analytics purposes.

## Implementation Spec

### Data Collection

- Collect user ID, game progress, and basic usage statistics (e.g., time spent in game, number of levels completed).
- Avoid collecting sensitive data such as IP addresses, personal identifiers, or biometric data unless absolutely necessary and with explicit user consent.

### Retention Schedules

- Run events: Store for 2 years.
- Biometric stress_score: Store for 90 days.
- Raw sentiment: Discard immediately after processing.

### GDPR Deletion Pipeline

- Implement a user-initiated deletion request system that removes all personal data associated with the user's account.
- Ensure prompt response to deletion requests and provide users with confirmation upon completion.

### Anonymization

- Before exporting data for analytics, anonymize it by removing any personally identifiable information (PII).
- Use techniques such as pseudonymization, data masking, or data obfuscation to protect user privacy.

## Edge Cases

- In case of legal requirements or investigations, store data beyond the retention schedule but ensure its anonymization and secure storage.
- If sensitive data is collected for a specific purpose with explicit user consent, it should be stored securely and deleted upon completion of the purpose or user request.
