import { Entity } from "@loopback/repository";
import { RebalancePulse, RebalanceAction, ResourceType } from "../models";

class RebalancingPulseService {
apply(pulse: RebalancePulse) {
pulse.actions.forEach((action) => {
const { resource, amount } = action;

// Access the relevant repository for the given resource type
const resourceRepository = AppConfig.getResourceRepositoryForType(resource);

// Fetch all entities of the specific resource type
const resources: Entity<any>[] = await resourceRepository.find({});

// Apply the specified amount to each resource entity
for (const resourceEntity of resources) {
const currentAmount = resourceEntity[resource];
resourceEntity[resource] = currentAmount + amount;

// Save the updated resource entity back to the database
await resourceRepository.save(resourceEntity);
}
});
}
}
