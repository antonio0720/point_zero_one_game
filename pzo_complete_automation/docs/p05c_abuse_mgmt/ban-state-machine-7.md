Ban State Machine v7
==================

Ban State Machine (BSM) is a system that manages user bans across multiple platforms, ensuring consistency and efficiency in the process. This document outlines version 7 of the BSM.

1. **States**
- `Active`: The ban is currently active.
- `Expired`: The ban has expired and is no longer in effect.
- `Removed`: The ban has been manually removed by an administrator.
- `Purged`: The user account has been permanently deleted, effectively removing the ban.
- `Ignored`: A system-generated message was ignored by the user, but no ban is currently in effect.
- `Pending`: A new ban request is being reviewed.
- `Banned`: The user is currently banned and the ban is yet to be reviewed.

2. **Transitions**

- From `Active` to `Expired` when the ban duration expires.
- From `Active` to `Removed` when an administrator manually removes the ban.
- From `Active` to `Purged` when the user account is permanently deleted.
- From `Ignored` to `Banned` if the user continues to ignore system-generated messages.
- From `Pending` to `Active` if the ban request is approved.
- From `Banned` to `Active` if the ban request is not withdrawn and the ban duration expires.

3. **Events**

- `BanRequested`: A new ban request is made for a user.
- `BanExpired`: The ban duration for a user has expired.
- `BanRemoved`: An administrator manually removes a ban for a user.
- `BanPurged`: A user's account is permanently deleted, removing the associated ban.
- `IgnoreMessage`: A user ignores a system-generated message.
- `WithdrawBanRequest`: A user or administrator withdraws a ban request.

4. **Notifications**

- When a new ban is requested, the user and relevant administrators are notified.
- When a ban expires, the user and relevant administrators are notified.
- When a ban is manually removed, the user and relevant administrators are notified.
- When a ban is permanently deleted due to account deletion, the user and relevant administrators are notified.
- When a user ignores system-generated messages, they are notified about the potential for a ban.
- When a ban request is approved or withdrawn, the user and relevant administrators are notified.
