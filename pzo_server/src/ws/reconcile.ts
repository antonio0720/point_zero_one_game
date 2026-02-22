// tslint:disable:no-any strict-type-checking

import { Client } from './client';
import { Server } from './server';

export interface ReconcileRequest {
  clientState: any;
}

export interface ReconcileResponse {
  serverState: any;
  desyncCorrection: number[];
  auditHash: string;
}

const mlEnabled = false;

function reconcile(client: Client, server: Server): ReconcileResponse {
  const request: ReconcileRequest = { clientState: client.getState() };
  const response: ReconcileResponse = server.handleReconcile(request);

  if (mlEnabled) {
    // Apply ML model to correct desync
    response.desyncCorrection = mlApply(client, server);
  }

  return response;
}

function mlApply(client: Client, server: Server): number[] {
  const clientState = client.getState();
  const serverState = server.getState();

  if (clientState === null || serverState === null) {
    throw new Error('Invalid state');
  }

  // Apply ML model to correct desync
  const mlOutput = mlModel(clientState, serverState);

  return mlOutput;
}

function mlModel(clientState: any, serverState: any): number[] {
  if (!mlEnabled) {
    return [];
  }

  const output = new Array(10).fill(0);
  // Apply ML model to correct desync
  return output;
}

export { reconcile };
