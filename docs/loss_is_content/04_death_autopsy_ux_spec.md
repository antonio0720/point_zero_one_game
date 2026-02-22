Title: Death Autopsy UX Spec for PZ1D - 12-minute Financial Roguelike Game

Overview:
This spec outlines the design and implementation of a guided replay snippet feature in the Death Autopsy user experience (UX) of Point Zero One Digital's 12-minute financial roguelike game. The goal is to provide players with a concise, engaging, and non-paralyzing analysis of their turning point during gameplay.

Non-negotiables:
1. Replay snippet duration: 10–20 seconds
2. Clear visual representation of the critical moment in the game
3. Optional deep dive for further analysis
4. Minimize analysis paralysis by presenting concise and actionable insights
5. Strict adherence to TypeScript, strict-mode, and deterministic effects

Implementation Spec:
1. **Triggering the Replay**: Implement a mechanism that allows players to initiate the replay at the point of their choosing during gameplay. This could be through an in-game menu or hotkey.

2. **Replay Snippet Generation**: Upon trigger, generate a 10–20 second snippet of the gameplay leading up to the chosen point. Ensure that this snippet is deterministic and can be replicated consistently for each player.

3. **Visual Representation**: Use clear and intuitive visual cues to highlight the critical moments within the replay snippet. This could include color-coding, annotations, or other graphical elements.

4. **Optional Deep Dive**: Provide an option for players to delve deeper into the analysis of their turning point. This could involve additional data visualizations, explanations of key decisions made during the gameplay, or suggestions for improvement.

5. **User Interface (UI) Design**: Design a clean and uncluttered UI that presents the replay snippet and deep dive information in an easy-to-understand format. Ensure that the UI is intuitive and user-friendly, minimizing the risk of analysis paralysis.

Edge Cases:
1. **Long Turning Points**: If a player's turning point extends beyond the 20-second limit, consider truncating the replay snippet to fit within the timeframe while still capturing the critical moments.

2. **First-time Players**: For players who are new to the game, provide additional context and explanations within the deep dive section to help them understand the analysis better.

3. **Performance Optimization**: Ensure that the replay feature does not negatively impact the performance of the game. Implement efficient data compression techniques and optimize the rendering of the replay snippet for smooth playback.
