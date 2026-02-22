interface Badge {
id: number;
name: string;
description: string;
}

abstract class BaseBadge implements Badge {
protected id: number;
protected name: string;
protected description: string;

constructor(id: number, name: string, description: string) {
this.id = id;
this.name = name;
this.description = description;
}
}

class UserBadge extends BaseBadge {
private userId: number;

constructor(id: number, name: string, description: string, userId: number) {
super(id, name, description);
this.userId = userId;
}
}

enum BadgeType {
ACHIEVEMENT = 'achievement',
PROGRESSION = 'progression'
}

class BadgeService {
public createBadge(type: BadgeType, badgeData: any): BaseBadge | UserBadge {
if (type === BadgeType.ACHIEVEMENT) {
return new AchievementBadge(badgeData);
} else if (type === BadgeType.PROGRESSION) {
// Assuming userId is provided in the badge data for progression badges
return new UserBadge(badgeData.id, badgeData.name, badgeData.description, badgeData.userId);
}
}
}

class AchievementBadge extends BaseBadge {
constructor(data: any) {
super(data.id, data.name, data.description);
}
}
