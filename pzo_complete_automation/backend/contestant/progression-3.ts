import { Contestant } from "./contestant";

enum ProgressionLevel {
BASE = 1,
INTERMEDIATE = 2,
ADVANCED = 3,
EXPERT = 4,
}

interface Progression {
level: ProgressionLevel;
requiredPoints: number;
}

class ProgressionManager {
private contestant: Contestant;
private progressions: Map<ProgressionLevel, Progression> = new Map([
[ProgressionLevel.BASE, { level: ProgressionLevel.BASE, requiredPoints: 0 }],
[ProgressionLevel.INTERMEDIATE, { level: ProgressionLevel.INTERMEDIATE, requiredPoints: 100 }],
[ProgressionLevel.ADVANCED, { level: ProgressionLevel.ADVANCED, requiredPoints: 500 }],
[ProgressionLevel.EXPERT, { level: ProgressionLevel.EXPERT, requiredPoints: 2000 }],
]);

constructor(contestant: Contestant) {
this.contestant = contestant;
}

public getCurrentProgression(): Progression | null {
for (const [level, progression] of this.progressions.entries()) {
if (this.contestant.points >= progression.requiredPoints) {
return progression;
}
}
return null;
}

public updateProgress(points: number): void {
const currentProgression = this.getCurrentProgression();

if (currentProgression) {
this.contestant.points += points;

if (this.contestant.points >= currentProgression.requiredPoints + 1) {
const nextLevel = this.progressions.get(currentProgression.level + 1);
if (nextLevel) {
this.contestant.level = nextLevel.level;
this.contestant.points -= currentProgression.requiredPoints;
}
}
}
}
}
