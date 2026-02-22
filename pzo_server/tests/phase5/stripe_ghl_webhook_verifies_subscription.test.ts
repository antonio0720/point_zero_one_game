import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Stripe/GHL webhook verifies subscription', () => {
  it('POST /runs/premium with invalid key → 403', async () => {
    const response = await request(app).post('/runs/premium').set('Authorization', 'Bearer invalid-key');
    expect(response.status).toBe(403);
  });

  it('Valid key → 200', async () => {
    const response = await request(app).post('/runs/premium').set('Authorization', process.env.STRIPE_GHL_WEBHOOK_SECRET);
    expect(response.status).toBe(200);
  });
});
