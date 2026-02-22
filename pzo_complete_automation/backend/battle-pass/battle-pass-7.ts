class Player {
battlePassLevel: number;
experience: number;

constructor(initialLevel: number) {
this.battlePassLevel = initialLevel;
this.experience = 0;
}

gainExperience(amount: number): void {
this.experience += amount;
if (this.experience >= 100) {
this.levelUp();
}
}

levelUp(): void {
this.battlePassLevel++;
this.experience -= 100;
}
}

class Achievement {
name: string;
reward: number;

constructor(name: string, reward: number) {
this.name = name;
this.reward = reward;
}
}

class Quest {
name: string;
description: string;
reward: Achievement[];

constructor(name: string, description: string, rewards: Achievement[]) {
this.name = name;
this.description = description;
this.reward = rewards;
}
}

class BattlePass {
quests: Quest[];

constructor() {
this.quests = [
new Quest(
"Quest 1",
"Complete this quest to unlock rewards!",
[new Achievement("Achievement 1", 10), new Achievement("Achievement 2", 20)]
),
// Add more quests as needed...
];
}

getCurrentQuest(): Quest | null {
const currentBattlePassLevel = this.getPlayer().battlePassLevel;
return this.quests[currentBattlePassLevel - 1] || null;
}

getPlayer(): Player {
// Assuming there's a global player or you have access to the player object elsewhere in your application
return new Player(1);
}
}

const battlePass = new BattlePass();
const currentQuest = battlePass.getCurrentQuest();
if (currentQuest) {
console.log(`Current Quest: ${currentQuest.name}`);
} else {
console.log("No active quest found.");
}
