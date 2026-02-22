import { Contestant } from "./contestant";

export class Progression1 implements Contestant.Progression {
private _currentLevel: number;
private _maxLevel: number;
private _experience: number;
private _nextLevelExperience: number;

constructor(maxLevel: number, nextLevelExperience: number) {
this._currentLevel = 1;
this._maxLevel = maxLevel;
this._nextLevelExperience = nextLevelExperience;
this._experience = 0;
}

get currentLevel(): number {
return this._currentLevel;
}

levelUp(): void {
if (this._currentLevel < this._maxLevel) {
this._experience -= this._nextLevelExperience;
this._currentLevel++;
this._nextLevelExperience *= 2;
}
}

addExperience(amount: number): void {
this._experience += amount;
while (this._experience >= this._nextLevelExperience) {
this.levelUp();
}
}
}
