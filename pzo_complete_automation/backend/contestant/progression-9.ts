```typescript
import { Contestant } from "./contestant-8";

export class ContestantProgression9 extends Contestant {
private _score: number;

constructor(name: string, id: number) {
super(name, id);
this._score = 0;
}

public get score(): number {
return this._score;
}

public increaseScore(points: number): void {
if (points > 0) {
this._score += points;
}
}

public hasWonGame(): boolean {
return this.score >= 100;
}
}
```

This code extends the existing Contestant class from Progression-8 and adds a new property `_score` to keep track of the contestant's score, along with methods `increaseScore()` and `hasWonGame()`. The `increaseScore()` method checks if the given points are positive before adding them to the score. The `hasWonGame()` method checks if the contestant has scored 100 or more points, indicating they have won the game.
