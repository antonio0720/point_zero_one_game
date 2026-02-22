Title: Frontend UX Spec for pzo_season0_founding_era_waitlist_engine_v1

Overview
---------

This document outlines the user experience (UX) specifications for the required surfaces in the Point Zero One Digital's 12-minute financial roguelike game, Sovereign infrastructure architect design. The focus is on reproducing and expanding the five essential surfaces: Entry, Reveal, MembershipCard, AfterRun, and Lobby.

Non-negotiables
-----------------

1. **Simplicity**: Minimize complexity to ensure a pressure-free experience for users.
2. **Clarity**: Ensure all elements are self-explanatory with clear visual cues.
3. **Single Next Action**: Each screen should have only one primary action, reducing user confusion.
4. **No Nested Menus**: Avoid using nested menus to maintain a clean and intuitive interface.

Implementation Spec
--------------------

### Entry

- The entry screen should provide a brief introduction to the game, its purpose, and the waitlist process.
- A prominent "Join Waitlist" button should be placed at the center of the screen for easy access.
- An optional "Learn More" link can be provided for users who want more information before joining.

### Reveal

- Upon clicking the "Join Waitlist" button, users are taken to the reveal screen.
- The screen should display a unique membership ID and a message confirming their successful addition to the waitlist.
- A "Back to Lobby" button should be placed at the bottom of the screen for easy navigation.

### MembershipCard

- The membership card screen should display the user's membership details, including their name (if provided during registration), membership ID, and game progress (if applicable).
- The card should have a clean and modern design to enhance its appeal.
- A "Back to Lobby" button should be placed at the bottom of the screen for easy navigation.

### AfterRun

- The after-run screen should display the user's performance in the game, including their score, rank, and any rewards earned.
- A "View Details" button can be provided to allow users to see a breakdown of their performance.
- A "Back to Lobby" button should be placed at the bottom of the screen for easy navigation.

### Lobby

- The lobby serves as the game's main hub, providing access to various features such as the waitlist, game modes, and settings.
- Each feature should have a clear and distinct visual representation to facilitate easy navigation.
- A "Settings" button can be placed at the top right corner of the screen for users to adjust game preferences.

Edge Cases
-----------

1. **Membership ID Duplication**: In case a user tries to join the waitlist with an already registered membership ID, display an error message and provide options to either correct the ID or create a new one.
2. **Game Unavailability**: If the game is not available for play due to maintenance or other reasons, display a clear message explaining the situation and an estimated time of availability.
3. **Reward Redemption Limitations**: Implement limitations on reward redemptions to prevent abuse and ensure fairness among users.
