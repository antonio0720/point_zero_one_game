LiveOps Control Plane - Feature Flags (v2)
==========================================

Overview
--------

The Feature Flags (v2) is a powerful tool in the LiveOps Control Plane, enabling developers to manage and control various features for different user groups or specific environments. This document outlines the key concepts, usage, and best practices for utilizing Feature Flags v2 effectively.

### Prerequisites

* Familiarity with the LiveOps Control Plane and its functionalities
* Access to the LiveOps API (API Key required)

Key Concepts
------------

1. **Flag**: A flag is a boolean variable that can be enabled or disabled, controlled by the Feature Flags system. It serves as a switch for specific features in your application.

2. **Targeting**: Targeting allows you to control which users or environments should be affected by a given flag. You can target flags based on user ID, device ID, location, and more.

3. **Rollout**: A rollout defines how quickly a feature should become available to the targeted audience after being enabled for that specific flag. This includes gradual rollouts (e.g., 10% every hour) or immediate ones (100% at once).

4. **Experiment**: An experiment is a collection of flags, targeting rules, and rollout strategies for running A/B tests, canary releases, and other experiments on your live application.

Usage
-----

### Creating Flags

To create a new flag, use the following API call:

```bash
POST /flags
{
"key": "YOUR_FLAG_KEY",
"value": true,
"description": "Your flag description"
}
```

Replace `YOUR_FLAG_KEY` with a unique identifier for your flag.

### Targeting Flags

To target a specific user or group of users, use the following API call:

```bash
PATCH /flags/YOUR_FLAG_KEY
{
"targeting": {
"users": [
"USER_ID_1",
"USER_ID_2"
],
"devices": ["DEVICE_ID_1"]
// Add more targeting options as needed
}
}
```

Replace `YOUR_FLAG_KEY` with the unique identifier for your flag, and specify the user IDs or device IDs you wish to target.

### Controlling Rollouts

To control the rollout of a specific flag, use the following API call:

```bash
PATCH /flags/YOUR_FLAG_KEY
{
"rollout": {
"strategy": "IMMEDIATE", // Or choose another strategy like "STAGING" or "GRADUAL"
"percentage": 100, // Define the rollout percentage
"cooldown_period": 60 // Optional cooldown period (in seconds)
}
}
```

Replace `YOUR_FLAG_KEY` with the unique identifier for your flag, and specify the desired rollout strategy, percentage, and cooldown period.

### Creating Experiments

To create a new experiment, use the following API call:

```bash
POST /experiments
{
"name": "Your experiment name",
"flags": ["FLAG_1", "FLAG_2"], // List of flags to include in the experiment
// Add more options like targeting and rollout as needed
}
```

Replace `YOUR_EXPERIMENT_NAME`, `FLAG_1`, and `FLAG_2` with appropriate names for your experiment and flags, respectively.

Best Practices
--------------

* Use meaningful flag keys and descriptions to easily identify and manage your flags
* Start small when rolling out new features, gradually increasing the rollout percentage over time
* Utilize targeting rules to control which users or devices are affected by a given flag
* Monitor the performance of experiments closely and iterate based on user feedback and data analysis

Conclusion
----------

The Feature Flags (v2) in the LiveOps Control Plane offer a powerful solution for managing features, running A/B tests, and deploying canary releases. By following best practices and using the provided API calls, you can easily control various aspects of your live application with confidence.
