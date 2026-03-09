export namespace opsBoard {
  export interface GameEvent {
    id: string;
    timestamp: Date;
    type: string;
    payload: unknown;
  }

  export interface GameState {
    sessionId: string;
    stateData: unknown;
  }

  export interface OpsBoardResponse {
    success: boolean;
    message?: string;
    data?: unknown;
  }

  export type OpsBoardHandler = (event: GameEvent, state: GameState) => Promise<OpsBoardResponse>;

  export const handleEvent: OpsBoardHandler = async (_event, _state) => {
    return { success: true };
  };
}
