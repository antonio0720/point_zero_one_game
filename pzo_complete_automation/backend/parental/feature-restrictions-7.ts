interface Feature {
name: string;
ageRestriction?: number;
}

enum Features {
Movies = "movies",
Music = "music",
Games = "games",
SocialMedia = "social_media"
}

interface User {
id: string;
age: number;
features: Feature[];
}

function checkAgeRestriction(user: User, feature: Feature): boolean {
if (feature.ageRestriction && user.age < feature.ageRestriction) {
return false;
}
return true;
}

function canAccessFeature(user: User, featureName: string): boolean {
const feature = featuresMap[featureName];
if (!feature) {
throw new Error(`Invalid feature name: ${featureName}`);
}
return checkAgeRestriction(user, feature);
}

const featuresMap: Record<string, Feature> = {
[Features.Movies]: { name: Features.Movies, ageRestriction: 13 },
[Features.Music]: { name: Features.Music },
[Features.Games]: { name: Features.Games, ageRestriction: 18 },
[Features.SocialMedia]: { name: Features.SocialMedia }
};
