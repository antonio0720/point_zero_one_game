import { Entity } from "../entity/Entity";
import { GameManager } from "../GameManager";
import { Rebalancer } from "./Rebalancer";
import { BalanceProfile } from "./BalanceProfile";

export class Pulse7Rebalancer extends Rebalancer {
private static _instance: Pulse7Rebalancer;

public static get Instance(): Pulse7Rebalancer {
if (!Pulse7Rebalancer._instance) {
Pulse7Rebalancer._instance = new Pulse7Rebalancer();
}

return Pulse7Rebalancer._instance;
}

private constructor() {
super();

this.balanceProfile = BalanceProfile.Pulse7;
}

public execute(): void {
GameManager.Entities.forEach((entity: Entity) => {
if (entity.IsAlive && entity.HasComponent(this.balanceProfile.affectedComponents)) {
this.applyAdjustments(entity);
}
});
}

private applyAdjustments(entity: Entity): void {
const { affectStat, statMultiplier, statAdditive } = this.balanceProfile;
const affectedComponent = entity.GetComponent(this.balanceProfile.affectedComponents[0]);

if (affectedComponent) {
let newValue: number;

switch (affectStat) {
case "add":
newValue = affectedComponent.stat + statAdditive;
break;
case "multiply":
newValue = affectedComponent.stat * statMultiplier;
break;
default:
throw new Error(`Unsupported affectStat: ${affectStat}`);
}

affectedComponent.stat = Math.min(newValue, this.balanceProfile.maxValue);
}
}
}
