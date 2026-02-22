# Player Trust UI - Store Listing Badges

Overview:
This document outlines the rules and specifications for store listing badges in Point Zero One Digital's 12-minute financial roguelike game. The badges serve to clarify the nature of in-game purchases, ensuring transparency and player trust.

Non-negotiables:
1. Badges must be clearly visible and easily understandable for players.
2. The badges should not affect game outcomes or provide any competitive advantage.
3. The badges are purely cosmetic and do not grant access to exclusive content outside of the specified "Episode access" badge.
4. No fine print is allowed; all information must be clearly conveyed within the badge design itself.
5. Strict adherence to TypeScript's strict mode and avoidance of the 'any' type is mandatory for all code related to these badges.
6. All effects associated with these badges are deterministic, ensuring fairness and consistency across all game sessions.

Implementation Spec:
1. 'Does not affect outcomes': This badge indicates that the purchase does not impact the player's chances of winning or losing in the game.
2. 'Cosmetic': This badge signifies that the purchase is purely for aesthetic purposes, changing the appearance of the player's character or environment without affecting gameplay.
3. 'Episode access': This badge denotes that the purchase grants access to additional episodes or content within the game. The specific episode(s) should be clearly stated in the badge design.

Edge Cases:
1. If a purchase affects game outcomes, it must not be marketed with the 'Does not affect outcomes' badge.
2. If a purchase provides access to content outside of the specified episode(s), it must not be marketed with the 'Episode access' badge.
3. If a cosmetic item significantly alters gameplay, it should be clearly marked as such and may require additional review before being approved for use with the 'Cosmetic' badge.
