# B2B Privacy Compliance Posture

## Overview

This document outlines Point Zero One Digital's privacy compliance posture for Business-to-Business (B2B) interactions. The focus is on maintaining data privacy, ensuring compliance with relevant regulations, and providing transparency in our practices.

## Non-Negotiables

1. **Individual PII Exclusion**: No Individual Personally Identifiable Information (PII) will be included in analytics exports.
2. **Aggregation Threshold**: Data will be aggregated to ensure individual privacy, with a minimum threshold for statistical significance.
3. **Data Residency Options**: Users can choose the geographical location where their data is stored and processed, subject to local laws and regulations.
4. **DPA Template**: A Data Processing Agreement (DPA) template will be provided for all B2B partners.
5. **CCPA/GDPR Compliance Notes**: The game adheres to the California Consumer Privacy Act (CCPA) and General Data Protection Regulation (GDPR), providing users with the right to access, delete, and opt-out of data collection.
6. **FERPA Posture for Schools**: For educational institutions, we comply with the Family Educational Rights and Privacy Act (FERPA), ensuring student privacy and confidentiality.
7. **Recommended Counsel Review Points**: We recommend that our B2B partners consult legal counsel to review and understand our data practices and their implications under local laws and regulations.

## Implementation Spec

1. **Data Collection**: Minimal PII is collected, only what is necessary for account creation and billing purposes.
2. **Data Processing**: All data processing follows strict-mode TypeScript guidelines, ensuring deterministic effects and no use of 'any'.
3. **Data Storage**: Data is stored securely, with options for users to choose their preferred data residency location.
4. **Data Sharing**: No PII will be shared without explicit user consent or as required by law.
5. **Data Retention**: User data will be retained only as long as necessary for the intended purpose and in accordance with local retention laws.
6. **Data Breach Notification**: In case of a data breach, affected users will be notified promptly in accordance with applicable laws.
7. **User Control**: Users have the right to access, correct, or delete their data at any time.

## Edge Cases

1. **Anonymous Analytics**: For users who opt-out of data collection, anonymous analytics data may still be collected for game improvement purposes. This data does not contain PII.
2. **Legal Requests**: In cases where law enforcement or regulatory bodies require access to user data, we will comply within the bounds of applicable laws and regulations.
