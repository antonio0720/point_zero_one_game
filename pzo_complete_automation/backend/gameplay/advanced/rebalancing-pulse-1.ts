import { Entity } from "../entity/Entity";
import { Rebalancer } from "./Rebalancer";
import { GameService } from "../services/GameService";
import { TimeService } from "../services/TimeService";

export class RebalancingPulse1 implements Rebalancer {
private duration: number;
private elapsedTime: number = 0;

constructor(private gameService: GameService, private timeService: TimeService) {}

public start(): void {
this.duration = 60 * 60; // Duration in seconds, e.g., 1 hour
this.elapsedTime = 0;
}

public update(deltaTime: number): void {
this.elapsedTime += deltaTime;

if (this.elapsedTime >= this.duration) {
// Rebalancing logic goes here

this.gameService.rebalancePlayers();

this.elapsedTime = 0;
}
}
}
