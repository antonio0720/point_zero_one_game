# Point Zero One Digital - Instrumentation Model

## Overview

This document outlines the instrumentation model for Point Zero One Digital's financial roguelike game. The model is designed to capture authoritative server events, ensuring a production-grade, deployment-ready system.

## Non-Negotiables

1. **Event Taxonomy**: A clear and comprehensive event taxonomy must be established to ensure consistent tracking of all relevant game actions.
2. **Idempotency**: The instrumentation model should be idempotent, meaning that multiple identical requests will not result in different outcomes or data corruption.
3. **Sampling**: Implement a sampling strategy to reduce the volume of data collected without compromising the integrity of the data or its usefulness for analysis.
4. **Privacy Boundaries**: Respect user privacy by anonymizing and aggregating data where necessary, while still maintaining the integrity of the data for analysis purposes.

## Implementation Spec

1. **Event Definition**: Each event in the game should be clearly defined, including its purpose, trigger conditions, and any associated data.
2. **Event Tracking**: Events should be tracked at the authoritative server level to ensure accurate and consistent data collection.
3. **Data Structure**: Use a structured data format (e.g., JSON) for event data to facilitate easy parsing and analysis.
4. **Sampling Strategy**: Implement a sampling strategy based on event type, frequency, or other relevant factors to reduce the volume of data collected without compromising its integrity.
5. **Anonymization and Aggregation**: Anonymize and aggregate user data where necessary to respect privacy boundaries while still maintaining the integrity of the data for analysis purposes.
6. **Error Handling**: Implement robust error handling to ensure that data collection continues even in the event of errors or exceptions.
7. **Logging**: Maintain detailed logs of all events, including any errors or exceptions encountered during data collection.

## Edge Cases

1. **Rare Events**: Develop a strategy for handling rare events that may not be captured frequently enough to be useful in the sampling process. This could involve increasing the sampling rate for these events or manually reviewing them when they occur.
2. **Data Integrity**: Implement checks to ensure the integrity of the data collected, such as hash comparisons or consistency checks between different event types.
3. **Privacy Concerns**: Establish clear guidelines for handling sensitive user data, including data retention policies and procedures for addressing potential privacy breaches.
