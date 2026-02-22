# Comment Pin Templates and High-Engagement Pins for Revenge Run and Social Challenge Formats

## Overview

This document outlines the creation of 5 comment pin templates and 5 new high-engagement pins specifically designed for the Revenge Run and Social Challenge formats in Point Zero One Digital's financial roguelike game. All templates adhere to strict TypeScript standards, ensuring deterministic effects and production-grade deployment readiness.

## Non-Negotiables

1. Strict TypeScript: All code will be written in strict mode with no exceptions for 'any'.
2. Deterministic Effects: All effects associated with the comment pins must be predictable to ensure fair gameplay.
3. Production-Grade: The templates and high-engagement pins should be deployment-ready, adhering to Point Zero One Digital's infrastructure architect design principles.

## Implementation Spec

### Base Comment Pin Templates

1. **General Discussion**: Encourages players to discuss game strategies, share tips, or ask questions about the game mechanics.

```markdown
[CommentPin: GeneralDiscussion]
```

2. **Bug Report**: Allows players to report any issues they encounter during gameplay.

```markdown
[CommentPin: BugReport]
```

3. **Feedback**: Invites players to share their thoughts, suggestions, or complaints about the game.

```markdown
[CommentPin: Feedback]
```

4. **Bragging Rights**: Provides a space for players to show off their high scores, achievements, or other impressive feats.

```markdown
[CommentPin: BraggingRights]
```

5. **Community Challenge**: Encourages players to collaborate on a specific challenge within the game.

```markdown
[CommentPin: CommunityChallenge]
```

### High-Engagement Pins for Revenge Run and Social Challenge Formats

1. **Revenge Run Invite**: Sends an invitation to players who have recently defeated another player, encouraging them to take revenge.

```markdown
[HighEngagementPin: RevengeRunInvite]
```

2. **Social Challenge Acceptance**: Notifies the challenger that their challenge has been accepted by the challenged player.

```markdown
[HighEngagementPin: SocialChallengeAccepted]
```

3. **Social Challenge Decline**: Informs the challenger that the challenged player has declined their social challenge.

```markdown
[HighEngagementPin: SocialChallengeDeclined]
```

4. **Revenge Run Victory**: Celebrates a player's victory in a Revenge Run, encouraging them to continue challenging others.

```markdown
[HighEngagementPin: RevengeRunVictory]
```

5. **Social Challenge Completion**: Notifies both players when a Social Challenge has been completed.

```markdown
[HighEngagementPin: SocialChallengeCompleted]
```

### Edge Cases

1. In case of multiple Revenge Run invitations from the same player, only the most recent invitation should be displayed.
2. If a player declines a Social Challenge and later accepts it, the previous Decline pin should be replaced with an Accepted pin.
3. If a Social Challenge is not completed within a reasonable timeframe, both players should receive a reminder to finish the challenge.
4. In case of a tie in a Social Challenge, both players should receive a special Tie pin.
5. If a player encounters an issue while using a High-Engagement Pin, they should be able to report it through the Bug Report pin.

```markdown
[CommentPin: BugReport]
