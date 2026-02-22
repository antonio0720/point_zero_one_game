import { Observable, from, interval } from 'rxjs';
import { map, mergeMap, take, tap } from 'rxjs/operators';

class Game {
private gameLoop: Observable<void>;

constructor(private updateIntervalMs: number) {
this.gameLoop = interval(updateIntervalMs).pipe(
mergeMap(() =>
from([this.update(), this.render()]).toArray()
),
take(-1) // Infinite loop until unsubscribe
);
}

public update(): void {
console.log('Updating game state...');
}

public render(): void {
console.log('Rendering updated game state...');
}

public start(): void {
this.gameLoop.subscribe();
}

public stop(): void {
this.gameLoop.unsubscribe();
}
}

const game = new Game(10); // Update every 10ms
game.start();

// Stress test by subscribing to multiple instances of the same game loop
const subscription1 = game.gameLoop;
setTimeout(() => {
const subscription2 = game.gameLoop;
setTimeout(() => {
const subscription3 = game.gameLoop;
// You can add more subscriptions here for additional stress testing
}, 500);
}, 500);
