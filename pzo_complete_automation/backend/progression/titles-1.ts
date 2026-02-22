class Player {
private titles: string[] = [];
private experience: number = 0;

public getTitles(): string[] {
return this.titles;
}

public earnTitle(title: string): void {
if (this.hasEnoughExperienceForTitle(title)) {
this.titles.push(title);
this.addExperienceForTitle(title);
}
}

private hasEnoughExperienceForTitle(title: string): boolean {
const titleExperienceRequirement = getTitleExperienceRequirement(title);
return this.experience >= titleExperienceRequirement;
}

private addExperienceForTitle(title: string): void {
const titleExperienceReward = getTitleExperienceReward(title);
this.experience += titleExperienceReward;
}
}

function getTitleExperienceRequirement(title: string): number {
// Return the required experience for a specific title here.
// For example, if "Bronze" requires 100 experience and "Silver" requires 500 experience:
switch (title) {
case 'Bronze':
return 100;
case 'Silver':
return 500;
// Add more titles as needed.
}
}

function getTitleExperienceReward(title: string): number {
// Return the experience reward for a specific title here.
// For example, if "Bronze" rewards 100 experience and "Silver" rewards 500 experience:
switch (title) {
case 'Bronze':
return 100;
case 'Silver':
return 500;
// Add more titles as needed.
}
}
