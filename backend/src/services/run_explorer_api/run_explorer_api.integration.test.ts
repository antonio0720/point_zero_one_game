import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Run Explorer API Integration Tests', () => {
  let server;

  beforeEach(async () => {
    server = await globalThis.startServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('should handle public lookup correctly', async () => {
    const response = await globalThis.request({
      url: '/api/v1/runs/PUBLIC_RUN_ID',
      method: 'GET',
    });

    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      status: 'success',
      data: { /* expected structure for a public run */ },
    });
  });

  it('should handle private lookup correctly when authenticated', async () => {
    const authResponse = await globalThis.request({
      url: '/api/v1/auth',
      method: 'POST',
      body: { username: 'test_user', password: 'test_password' },
    });

    expect(authResponse.statusCode).toEqual(200);
    const authToken = authResponse.body.data.token;

    const response = await globalThis.request({
      url: '/api/v1/runs/PRIVATE_RUN_ID',
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      status: 'success',
      data: { /* expected structure for a private run */ },
    });
  });

  it('should return 401 when attempting private lookup without authentication', async () => {
    const response = await globalThis.request({
      url: '/api/v1/runs/PRIVATE_RUN_ID',
      method: 'GET',
    });

    expect(response.statusCode).toEqual(401);
  });

  it('should handle unlisted run lookup correctly when authenticated as admin', async () => {
    const authResponse = await globalThis.request({
      url: '/api/v1/auth',
      method: 'POST',
      body: { username: 'admin_user', password: 'admin_password' },
    });

    expect(authResponse.statusCode).toEqual(200);
    const authToken = authResponse.body.data.token;

    const response = await globalThis.request({
      url: '/api/v1/runs/UNLISTED_RUN_ID',
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      status: 'success',
      data: { /* expected structure for an unlisted run */ },
    });
  });

  it('should return 403 when attempting to view unlisted run as non-admin user', async () => {
    const authResponse = await globalThis.request({
      url: '/api/v1/auth',
      method: 'POST',
      body: { username: 'test_user', password: 'test_password' },
    });

    expect(authResponse.statusCode).toEqual(200);
    const authToken = authResponse.body.data.token;

    const response = await globalThis.request({
      url: '/api/v1/runs/UNLISTED_RUN_ID',
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toEqual(403);
  });

  it('should handle quarantined run lookup correctly when authenticated as admin', async () => {
    const authResponse = await globalThis.request({
      url: '/api/v1/auth',
      method: 'POST',
      body: { username: 'admin_user', password: 'admin_password' },
    });

    expect(authResponse.statusCode).toEqual(200);
    const authToken = authResponse.body.data.token;

    const response = await globalThis.request({
      url: '/api/v1/runs/QUARANTINED_RUN_ID',
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toEqual(200);
    expect(response.body).toMatchObject({
      status: 'success',
      data: { /* expected structure for a quarantined run */ },
    });
  });

  it('should return 403 when attempting to view quarantined run as non-admin user', async () => {
    const authResponse = await globalThis.request({
      url: '/api/v1/auth',
      method: 'POST',
      body: { username: 'test_user', password: 'test_password' },
    });

    expect(authResponse.statusCode).toEqual(200);
    const authToken = authResponse.body.data.token;

    const response = await globalThis.request({
      url: '/api/v1/runs/QUARANTINED_RUN_ID',
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toEqual(403);
  });

  it('should handle rate limit correctly', async () => {
    // Repeat the following request 10 times to trigger rate limiting
    for (let i = 0; i < 10; i++) {
      await globalThis.request({
        url: '/api/v1/runs/PUBLIC_RUN_ID',
        method: 'GET',
      });
    }

    // Attempt another request after the rate limit period (assuming 60 seconds)
    const response = await globalThis.request({
      url: '/api/v1/runs/PUBLIC_RUN_ID',
      method: 'GET',
    });

    expect(response.statusCode).toEqual(429);
    expect(response.body).toMatchObject({
      status: 'error',
      data: { message: 'Rate limit exceeded' },
    });
  });
});
