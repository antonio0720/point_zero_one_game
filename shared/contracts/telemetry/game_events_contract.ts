/**
 * Game Events Contract
 */

export interface GameEvent {
  id: number;
  timestamp: number;
  eventType: string;
  data?: any; // Temporarily allow any for flexibility, but aim to replace with specific types when possible
}

export interface PlayerAction extends GameEvent {
  playerId: number;
  action: string;
}

export interface ResourceTransaction extends GameEvent {
  resourceType: string;
  quantity: number;
  target?: number | string; // Target can be either a player ID or a resource type (for shared resources)
}

export interface GameStateUpdate extends GameEvent {
  stateKey: string;
  newState: any; // Temporarily allow any for flexibility, but aim to replace with specific types when possible
}

export function isGameEvent(event: any): event is GameEvent {
  return (
    typeof event.id === 'number' &&
    typeof event.timestamp === 'number' &&
    typeof event.eventType === 'string'
  );
}

export function isPlayerAction(event: any): event is PlayerAction {
  return isGameEvent(event) && typeof event.playerId === 'number';
}

export function isResourceTransaction(event: any): event is ResourceTransaction {
  return isGameEvent(event) && typeof event.resourceType === 'string' && typeof event.quantity === 'number';
}

export function isGameStateUpdate(event: any): event is GameStateUpdate {
  return isGameEvent(event) && typeof event.stateKey === 'string';
}
