interface Achievement {
id: string;
title: string;
description: string;
progress: number; // percentage of completion
}

interface Player {
name: string;
achievements: Achievement[];
currentTitleId?: string;
}

class ProgressionSystem {
players: Player[] = [];

addPlayer(name: string) {
const player: Player = { name, achievements: [] };
this.players.push(player);
}

getPlayer(name: string): Player | undefined {
return this.players.find((p) => p.name === name);
}

addAchievement(name: string, playerName: string) {
const achievement: Achievement = {
id: crypto.randomUUID(),
title: `Achievement ${name}`,
description: `Description for Achievement ${name}`,
progress: 0,
};

const player = this.getPlayer(playerName);
if (player) {
player.achievements.push(achievement);
}
}

updateAchievementProgress(id: string, progress: number) {
const achievement = this.getAchievementById(id);
if (achievement) {
achievement.progress = progress;
}
}

getAchievementById(id: string): Achievement | undefined {
return this.players.flatMap((p) => p.achievements).find((a) => a.id === id);
}

setCurrentTitleForPlayer(playerName: string, titleId?: string) {
const player = this.getPlayer(playerName);
if (player) {
player.currentTitleId = titleId;
}
}

getCurrentTitleForPlayer(playerName: string): string | undefined {
const player = this.getPlayer(playerName);
return player?.currentTitleId || "";
}
}
