# Telemetry Spine - Event Taxonomy v7

## Overview

This document outlines the latest version (v7) of the Telemetry Spine Event Taxonomy, a comprehensive structure that categorizes various events occurring within the system for efficient data management and analysis.

## Key Components

1. **Event Categories**: The main categories that all events fall under, such as System, User Interaction, and Performance.

2. **Event Types**: Detailed sub-categories within each event category, defining specific types of events.

3. **Event Properties**: Additional information associated with each event, like timestamps, severity levels, and event identifiers.

## Event Categories (v7)

1. **System**
- System Startup/Shutdown
- Software Updates
- Configuration Changes
- Error Logs

2. **User Interaction**
- User Authentication
- UI Interactions (clicks, scrolls, etc.)
- Data Input/Output Operations

3. **Performance**
- CPU Utilization
- Memory Usage
- Network Traffic
- Response Times

4. **Security**
- Login Attempts (successful and failed)
- Access Denied Events
- Unauthorized Actions

5. **Alerting**
- Critical Alerts
- Warning Alerts
- Informational Alerts

## Event Types Examples

### System
- System Startup Event (System, System Startup/Shutdown)
- timestamp: 2023-05-15T14:30:00Z
- identifier: SYS_STARTUP_20230515_143000

### User Interaction
- UI Button Click Event (User Interaction, UI Interactions)
- timestamp: 2023-05-15T14:35:00Z
- identifier: USER_INTERACTION_UI_CLICK_20230515_143500

### Performance
- CPU Utilization Peak Event (Performance, CPU Utilization)
- timestamp: 2023-05-15T15:00:00Z
- identifier: PERF_CPU_UTILIZATION_PEAK_20230515_150000

### Security
- Failed Login Attempt Event (Security, Login Attempts)
- timestamp: 2023-05-15T16:00:00Z
- identifier: SEC_FAILED_LOGIN_ATTEMPT_20230515_160000

### Alerting
- Critical Alert Event (Alerting, Critical Alerts)
- timestamp: 2023-05-15T17:00:00Z
- identifier: ALERT_CRITICAL_20230515_170000
- alert_severity: CRITICAL

## Event Properties

### Common properties for all events
- **timestamp**: The exact time when the event occurred, in UTC format.
- **identifier**: A unique identifier for each event, used to track individual occurrences of an event.

### Additional properties specific to certain event types
- **event_type**: The specific type of event that occurred.
- **user_id**: The identifier of the user who interacted with the system (if applicable).
- **resource_id**: The identifier of the affected resource within the system (if applicable).
