import { Badge } from './badges';

export class User {
constructor(public id: string, public name: string) {}

private _badges: Set<Badge> = new Set();

addBadge(badge: Badge): void {
this._badges.add(badge);
}

hasBadge(badge: Badge): boolean {
return this._badges.has(badge);
}
}

export class BadgeRepository {
private _badges: Map<string, Badge> = new Map();

addBadge(badge: Badge): void {
this._badges.set(badge.id, badge);
}

getBadgeById(id: string): Badge | undefined {
return this._badges.get(id);
}
}

const userRepo = new UserRepository();
const badgeRepo = new BadgeRepository();

// Add some badges to the repository
badgeRepo.addBadge(new Badge('1', 'Bronze'));
badgeRepo.addBadge(new Badge('2', 'Silver'));
badgeRepo.addBadge(new Badge('3', 'Gold'));

// Create a user and add badges
const user = new User('1', 'John Doe');
user.addBadge(badgeRepo.getBadgeById('1')!);
user.addBadge(badgeRepo.getBadgeById('2')!);
