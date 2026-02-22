# Weekly Micro-Patch Cadence for Point Zero One Digital Games

Overview:
This document outlines the weekly micro-patch cadence for Point Zero One Digital games, ensuring a consistent and transparent approach to updates. The process includes detection, decision, ship, and communicate stages.

Non-Negotiables:
1. Patches must be released every week without exception.
2. All patches must adhere to strict TypeScript standards with no usage of 'any'.
3. All code should be in strict mode.
4. All effects must be deterministic.
5. Patch notes, pinned posts, and first-run tooltips are mandatory for each patch release.

Implementation Spec:
1. **Detection**: Continuously monitor the game for issues and feedback from players. This can be done through various channels such as in-game reports, community forums, and analytics data.
2. **Decision**: Evaluate the severity of detected issues and prioritize them based on their impact on the player experience. Decide which issues will be addressed in the upcoming patch.
3. **Ship**: Once decisions are made, develop and test the necessary fixes or improvements. Ensure all code adheres to our strict TypeScript standards and is deployment-ready.
4. **Communicate**: After the patch has been deployed, create and publish patch notes detailing the changes, fixes, and improvements included in the update. Post these notes on relevant channels such as the game's official website, social media platforms, and in-game news sections. Additionally, pin the patch note post for easy access by players. Lastly, implement a first-run tooltip that notifies players of the new update when they launch the game after the patch has been released.

Edge Cases:
1. **Emergency Patches**: In cases where an urgent issue arises that requires immediate attention, follow the same process but expedite it as necessary. Communicate the emergency patch to players with a clear explanation of the issue and the fixes implemented.
2. **Holiday Periods**: During holiday periods or scheduled downtime, adjust the patch release schedule accordingly. Notify players in advance about any changes to the weekly micro-patch cadence.
