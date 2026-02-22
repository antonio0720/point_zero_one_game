import { describe, it, expect } from 'vitest';
import { createServer } from '../server';
import { connectClient } from './utils';

describe('Two players connect to same room', () => {
  let server;
  let client1;
  let client2;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  it('both clients receive identical tick state every second', async () => {
    const roomName = 'test-room';
    client1 = await connectClient(server, roomName);
    client2 = await connectClient(server, roomName);

    const initialTickState = await client1.getTickState();
    expect(initialTickState).toBeDefined();

    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => globalThis.setTimeout(resolve, 1000));
      const tickState1 = await client1.getTickState();
      const tickState2 = await client2.getTickState();
      expect(tickState1).toEqual(tickState2);
    }
  });
});
