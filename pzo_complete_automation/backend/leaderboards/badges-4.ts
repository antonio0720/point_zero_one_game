// Implement the logic for leveling up the user
user.level += 1;
break;
case BadgeType.NewUser:
// Check if the user is new
if (!user.hasBadge(type)) {
user.badges.push({ type, user, awardedAt: new Date() });
}
break;
case BadgeType.DailyActive:
const currentDate = new Date();
const yesterday = new Date(currentDate);
yesterday.setDate(yesterday.getDate() - 1);

// Check if the user was active in the last day
if (!user.hasBadge(type) && user.wasActiveToday && user.wasActiveYesterday) {
user.badges.push({ type, user, awardedAt: new Date() });
}
break;
case BadgeType.WeeklyActive:
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

// Check if the user was active in the last week
if (!user.hasBadge(type) && user.wasActiveToday && user.wasActiveLastWeek) {
user.badges.push({ type, user, awardedAt: new Date() });
}
break;
default:
throw new Error(`Unknown badge type: ${type}`);
}
}
}
```

Assuming you have a User class that includes properties `leaderboard`, `badges`, and methods `hasBadge(type: BadgeType)`, `wasActiveToday` and `wasActiveLastWeek`.
