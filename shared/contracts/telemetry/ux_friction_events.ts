/**
 * UX Friction Events Contract
 */

export interface ModalStallEvent {
  timestamp: number;
  modalId: string;
}

export interface RepeatedSubmitEvent {
  timestamp: number;
  formId: string;
}

export interface UndoBackEvent {
  timestamp: number;
  action: 'undo' | 'back';
}

export interface DisconnectReconcileEvent {
  timestamp: number;
  playerId: string;
  previousConnectionState: 'connected' | 'disconnected';
  currentConnectionState: 'connected' | 'disconnected';
}

export interface RUMHookEvent {
  timestamp: number;
  performanceMetric: string;
  value: number;
}

/**
 * UX Friction Events Repository Interface
 */
export interface UXFrictionEventsRepository {
  recordModalStall(event: ModalStallEvent): Promise<void>;
  recordRepeatedSubmit(event: RepeatedSubmitEvent): Promise<void>;
  recordUndoBack(event: UndoBackEvent): Promise<void>;
  recordDisconnectReconcile(event: DisconnectReconcileEvent): Promise<void>;
  recordRUMHook(event: RUMHookEvent): Promise<void>;
}
