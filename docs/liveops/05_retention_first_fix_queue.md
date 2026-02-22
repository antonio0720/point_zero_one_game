Retention-First Fix Queue
==========================

Overview
--------

The Retention-First Fix Queue is a prioritized task list designed to address critical issues that impact player retention in Point Zero One Digital's 12-minute financial roguelike game. The queue focuses on UI speed and stability, reducing modal traps, confirming action submissions, optimizing replay loading, and minimizing share artifact friction.

Non-Negotiables
---------------

1. **UI Speed/Stability**: Ensure the user interface remains responsive and stable during gameplay to minimize frustration and improve player experience.
2. **Fewer Modal Traps**: Reduce instances where players are trapped within modals, preventing them from continuing their gameplay smoothly.
3. **Action-Submitted Confirmations**: Implement confirmation dialogues for critical actions to ensure players understand the consequences of their decisions and prevent accidental actions.
4. **Replay Loading Optimization**: Improve the loading time of replays to reduce wait times between games and maintain player engagement.
5. **Share Artifact Friction Reduction**: Simplify the process of sharing artifacts, making it easier for players to showcase their achievements and attract new players.

Implementation Spec
--------------------

1. **UI Speed/Stability Improvements**: Optimize UI components by minimizing unnecessary calculations, reducing redundant data requests, and implementing lazy loading techniques where appropriate.
2. **Modal Trap Prevention**: Implement a mechanism to automatically close modals when the user interacts with other UI elements or clicks outside of the modal.
3. **Action-Submitted Confirmations**: Add confirmation dialogues for critical actions such as saving, quitting, and spending resources. Ensure that these dialogues are clear, concise, and easy to understand.
4. **Replay Loading Optimization**: Analyze replay data to identify bottlenecks and implement optimizations such as preloading, compression, or parallel processing where possible.
5. **Share Artifact Friction Reduction**: Simplify the share artifact process by reducing the number of steps required, providing clear instructions, and offering multiple sharing options (e.g., social media, email, direct link).

Edge Cases
----------

1. **Modal Trap Prevention**: In cases where a modal is necessary for an extended period, consider implementing a "Close" button or providing an option to continue gameplay without closing the modal.
2. **Action-Submitted Confirmations**: For actions with immediate consequences (e.g., selling an item), ensure that confirmation dialogues are displayed promptly and do not require unnecessary user input.
3. **Replay Loading Optimization**: In situations where replay data is large or complex, consider implementing a loading progress bar to keep players informed about the remaining time until the replay is ready.
4. **Share Artifact Friction Reduction**: When sharing artifacts with players who are not part of the game's community, provide options for exporting artifacts as images or files that can be easily shared on external platforms.
