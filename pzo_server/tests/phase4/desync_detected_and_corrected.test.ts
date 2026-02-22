import { describe, it, expect } from 'vitest';
import { Server, Client } from '../../../src';

describe('Desync detected and corrected', () => {
  it('force desync in test, verify server state overrides client prediction', async () => {
    const server = new Server();
    const client = new Client();

    // Force a desync by setting the server's state to something different than the client's
    server.state = { foo: 'bar' };
    client.state = { foo: 'baz' };

    // Make sure the server's state is reflected in the client's prediction
    expect(client.getPrediction()).toEqual(server.state);

    // Now, let's simulate a desync by updating the server's state without notifying the client
    server.state = { foo: 'qux' };

    // The client should still be using its old prediction, which is now out of sync with the server
    expect(client.getPrediction()).toEqual({ foo: 'baz' });

    // But when we update the client's state to match the server's, it should correct the desync
    client.state = { ...server.state };

    // Now the client's prediction should be up to date and in sync with the server
    expect(client.getPrediction()).toEqual(server.state);
  });
});
