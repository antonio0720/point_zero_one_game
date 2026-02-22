interface Player {
id: number;
username: string;
achievements: Record<string, boolean>;
experience: number;
level: number;
title: string;
}

enum Achievement {
Beginner = "Beginner",
Intermediate = "Intermediate",
Advanced = "Advanced",
Expert = "Expert",
Master = "Master"
}

const achievements = {
[Achievement.Beginner]: 0,
[Achievement.Intermediate]: 100,
[Achievement.Advanced]: 500,
[Achievement.Expert]: 1000,
[Achievement.Master]: Infinity
};

const titles = {
[Achievement.Beginner]: "Novice",
[Achievement.Intermediate]: "Apprentice",
[Achievement.Advanced]: "Journeyman",
[Achievement.Expert]: "Master Craftsman",
[Achievement.Master]: "Grand Master"
};

function calculateExperience(player: Player): number {
return player.experience;
}

function calculateLevel(player: Player): number {
let level = 1;
while (calculateExperience(player) > achievements[Achievement.Beginner] && level < 6) {
if (calculateExperience(player) <= achievements[Object.keys(achievements)[level + 1]]) {
level++;
}
}
return level;
}

function calculateTitle(player: Player): string {
let title = titles[Achievement.Beginner];
for (let achievement in achievements) {
if (player.achievements[achievement as keyof Player['achievements']]) {
title = titles[achievement as Achievement];
break;
}
}
return title;
}

function updateAchievements(player: Player, newAchievements: Record<string, boolean>) {
player.achievements = { ...player.achievements, ...newAchievements };
}

function awardExperience(player: Player, experienceAmount: number) {
player.experience += experienceAmount;
}
