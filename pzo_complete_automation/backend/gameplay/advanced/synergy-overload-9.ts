import { GameEntity } from "../entities/GameEntity";
import { SynergyEffect, SynergyType } from "./Synergy";

class SynergyOverload9 implements SynergyEffect {
synergyType = SynergyType.SynergyOverload9;

private basePowerMultiplier: number;

constructor(basePowerMultiplier: number) {
this.basePowerMultiplier = basePowerMultiplier;
}

applyToEntity(entity: GameEntity): void {
entity.powerMultiplier *= this.basePowerMultiplier;
}
}
