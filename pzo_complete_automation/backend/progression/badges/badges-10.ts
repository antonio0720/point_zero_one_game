interface Badge {
id: number;
name: string;
description: string;
points: number;
}

class ProgressionSystem {
private badges: Badge[] = [];

constructor() {
this.badges.push({
id: 10,
name: "Badge 10",
description: "A description for Badge 10",
points: 10,
});
}

public getBadgeById(id: number): Badge | undefined {
return this.badges.find((badge) => badge.id === id);
}
}

const progressionSystem = new ProgressionSystem();

export { progressionSystem, Badge };
