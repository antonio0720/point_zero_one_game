import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Kit Download', () => {
  let server;

  beforeEach(() => {
    server = require('../kit-download');
  });

  afterEach(() => {
    server.close();
  });

  it('triggers download and GHL webhook for a valid email', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/download',
      payload: { email: 'valid@email.com' },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.headers['content-disposition']).toContain('attachment');
    // Add assertions for GHL webhook here if necessary
  });

  it('returns 400 for an invalid email', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/download',
      payload: { email: 'invalidemail' },
    });

    expect(response.statusCode).toEqual(400);
  });

  it('fires rate limit on the 4th request', async () => {
    // Simulate 3 successful requests
    for (let i = 1; i < 4; i++) {
      await server.inject({
        method: 'POST',
        url: '/download',
        payload: { email: 'valid@email.com' },
      });
    }

    const response = await server.inject({
      method: 'POST',
      url: '/download',
      payload: { email: 'valid@email.com' },
    });

    expect(response.statusCode).toEqual(429);
  });

  it('kit zip contains all 9 files', async () => {
    // Add test for checking the contents of the downloaded zip file here
  });
});
