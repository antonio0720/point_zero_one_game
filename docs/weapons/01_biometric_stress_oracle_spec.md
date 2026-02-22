Biometric Stress Oracle Specification
======================================

Overview
--------

The Biometric Stress Oracle is a component in Point Zero One Digital's 12-minute financial roguelike game that utilizes Heart Rate Variability (HRV) monitoring and a stress detection algorithm to dynamically adjust the difficulty of the game based on the player's stress levels. The system also includes a FUBAR card damage multiplier, which increases when stress is detected.

Non-Negotiables
---------------

1. Strict TypeScript adherence with no usage of 'any'. All code will be written in strict mode.
2. Deterministic effects to ensure fairness and reproducibility.
3. No raw biometric data storage for privacy protection.

Implementation Specification
-----------------------------

### HRV Monitoring Integration

The Biometric Stress Oracle will integrate with a compatible HRV monitoring device or software, which will provide real-time heart rate and HRV data. The device should be non-invasive and easy to use for the player.

### Stress Detection Algorithm

The stress detection algorithm will analyze the HRV data to determine the player's stress level. A higher HRV indicates a lower stress level, while a lower HRV indicates a higher stress level. The algorithm should be robust and capable of handling various heart rate patterns.

### FUBAR Card Damage Multiplier

When stress is detected, the FUBAR card damage multiplier will increase, causing the player's cards to take more damage during gameplay. The multiplier will range from 1.2 to 1.5x, with the exact value determined by the stress level.

### Personalized Difficulty without Manual Settings

Based on the detected stress level, the Biometric Stress Oracle will adjust the difficulty of the game in real-time. This includes modifying enemy behavior, resource availability, and other game parameters to create a more challenging or easier experience for the player.

Edge Cases
----------

1. If the HRV monitoring device is not compatible with the Biometric Stress Oracle, an error message will be displayed, and the player will be prompted to use a different device or software.
2. In situations where the HRV data is inconsistent or unreliable (e.g., due to movement or noise), the stress detection algorithm may produce inaccurate results. To mitigate this, the system should include a fallback mechanism that uses other factors such as player performance and game progression to determine stress levels.
3. If raw biometric data is accidentally stored, it will be immediately deleted to maintain privacy compliance.
