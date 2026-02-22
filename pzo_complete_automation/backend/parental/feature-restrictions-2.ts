interface User {
id: string;
age: number;
hasGivenConsent: boolean;
}

enum Feature {
Chat = "chat",
Games = "games",
Media = "media"
}

interface FeatureAccess {
[key in Feature]: boolean;
}

class ParentalControl {
private users: Record<string, User> = {};

constructor(defaultAge: number, defaultConsent: boolean) {
this.users = {
guest: { id: "guest", age: -1, hasGivenConsent: defaultConsent }
};
}

addUser(id: string, age: number, hasGivenConsent: boolean): void {
this.users[id] = { id, age, hasGivenConsent };
}

getAccess(id: string): FeatureAccess {
const user = this.users[id];

if (!user) return { [Feature.Chat]: false, [Feature.Games]: false, [Feature.Media]: false };

// Check age and consent requirements for each feature
const access: FeatureAccess = {
[Feature.Chat]: user.age >= 13 && user.hasGivenConsent,
[Feature.Games]: user.age >= 16 && user.hasGivenConsent,
[Feature.Media]: user.age >= 18 && user.hasGivenConsent
};

return access;
}
}
