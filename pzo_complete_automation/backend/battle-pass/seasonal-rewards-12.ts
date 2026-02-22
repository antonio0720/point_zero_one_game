class SeasonalRewards {
constructor(private id: number, private name: string) {}

public getId(): number {
return this.id;
}

public setId(id: number): void {
this.id = id;
}

public getName(): string {
return this.name;
}

public setName(name: string): void {
this.name = name;
}

// Add quests and achievements as properties of the class
private quests: Array<Quest>;
private achievements: Array<Achievement>;

// Assuming a Quest interface with id, title, and reward properties
// And an Achievement interface with id, title, and reward properties

public addQuest(quest: Quest): void {
this.quests.push(quest);
}

public addAchievement(achievement: Achievement): void {
this.achievements.push(achievement);
}

// Method to calculate total rewards from quests and achievements
public calculateTotalRewards(): Reward[] {
const questRewards = this.quests.map((quest) => quest.reward);
const achievementRewards = this.achievements.map((achievement) => achievement.reward);

return [...questRewards, ...achievementRewards];
}
}
