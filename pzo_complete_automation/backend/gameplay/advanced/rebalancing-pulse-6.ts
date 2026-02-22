import { GameEntity } from "../entities/GameEntity";
import { RebalanceManager } from "./RebalanceManager";
import { ResourceType } from "../constants/ResourceType";

// Rebalance Pulse 6
const REBALANCE_PULSE_6_START = 10 * 60; // 10 minutes
const REBALANCE_PULSE_6_INTERVAL = 30 * 60; // 30 minutes
const RESOURCE_MULTIPLIER = 1.2; // Resource multiplier for this pulse

RebalanceManager.on('pulseStart', () => {
const currentTime = Date.now();

if (currentTime >= REBALANCE_PULSE_6_START && (currentTime % REBALANCE_PULSE_6_INTERVAL === 0)) {
for (const entity of GameEntity.getAllEntities()) {
const resource = entity.resources.get(ResourceType.Metal);

if (resource) {
resource.amount *= RESOURCE_MULTIPLIER;
}
}
}
});
