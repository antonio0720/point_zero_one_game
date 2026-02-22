import { ClientId } from "./ClientId";
import { GameState } from "./GameState";
import { CloudSaveService } from "./CloudSaveService";
import { SyncHandler } from "./SyncHandler";
import { HandoffStrategy } from "./HandoffStrategy";

class MultiClientSync {
private clients: Map<ClientId, [GameState, number]> = new Map();
private cloudSaveService: CloudSaveService;
private syncHandler: SyncHandler;
private handoffStrategy: HandoffStrategy;

constructor(cloudSaveService: CloudSaveService, syncHandler: SyncHandler, handoffStrategy: HandoffStrategy) {
this.cloudSaveService = cloudSaveState;
this.syncHandler = syncHandler;
this.handoffStrategy = handoffStrategy;
}

public addClient(clientId: ClientId, initialGameState: GameState): void {
this.clients.set(clientId, [initialGameState, Date.now()]);
this.syncHandler.registerClient(clientId, this.handleSyncEvent.bind(this));
}

public removeClient(clientId: ClientId): void {
this.clients.delete(clientId);
this.syncHandler.unregisterClient(clientId);
}

private handleSyncEvent(event: SyncEvent, clientId: ClientId): void {
const [localGameState, localTimestamp] = this.clients.get(clientId) || [null, null];

if (localGameState === null) {
// The local game state is not yet initialized. Save the event to the cloud and return.
this.cloudSaveService.saveSyncEvent(event);
return;
}

const eventTimestamp = event.timestamp;
const shouldApplyEvent = eventTimestamp > localTimestamp || (eventTimestamp === localTimestamp && this.handoffStrategy.shouldHandOff(localGameState, event.data));

if (shouldApplyEvent) {
// The event is valid and needs to be applied. Apply the event locally and save it to the cloud.
const newLocalGameState = this.syncHandler.applySyncEvent(localGameState, event);
this.clients.set(clientId, [newLocalGameState, eventTimestamp]);
this.cloudSaveService.saveSyncEvent(event);
} else {
// The event is not valid or cannot be handoffed. Save the event to the cloud and return.
this.cloudSaveService.saveSyncEvent(event);
}
}
}
