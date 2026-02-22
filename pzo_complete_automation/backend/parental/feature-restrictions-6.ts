enum Feature {
Chat = "chat",
Media = "media",
Games = "games",
SocialMedia = "social-media"
}

interface User {
id: string;
age: number;
consents: Record<Feature, boolean>;
}

class FeatureRestrictions {
private users: Map<string, User> = new Map();

public addUser(user: User): void {
this.users.set(user.id, user);
}

public hasConsentForFeature(userId: string, feature: Feature): boolean {
const user = this.users.get(userId);
if (!user) return false;
return user.consents[feature];
}

public restrictFeature(userId: string, feature: Feature): void {
const user = this.users.get(userId);
if (!user) throw new Error("User not found");
user.consents[feature] = false;
}
}
