/**
 * Routes for handling host invites
 */

import express from 'express';
import { Request, Response } from 'express';
import db from '../database';
import WebhookClient from '@google-cloud/webhook';

const router = express.Router();

// Define the schema for the HostInvite table
const hostInviteTable = `
  CREATE TABLE IF NOT EXISTS host_invites (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255),
    host_name TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
  );
`;

// Define the schema for the Sessions table
const sessionsTable = `
  CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    format VARCHAR(255) NOT NULL,
    host_id INTEGER REFERENCES hosts(id),
    FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
  );
`;

// Define the schema for the Hosts table
const hostsTable = `
  CREATE TABLE IF NOT EXISTS hosts (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );
`;

router.get('/host/invite/:token', async (req: Request, res: Response) => {
  // Check if the invite token exists in the database
  const result = await db.query('SELECT * FROM host_invites WHERE token = $1', [req.params.token]);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Invite not found' });
  }

  const invite = result.rows[0];
  const session = await db.query('SELECT * FROM sessions WHERE id = $1', [invite.session_id]);

  if (session.rowCount === 0) {
    return res.status(500).json({ error: 'Session not found' });
  }

  // RSVP the invite and update the database
  await db.query('UPDATE host_invites SET session_id = $1 WHERE token = $2', [invite.session_id, req.params.token]);

  // Log the RSVP to the database
  await db.query('INSERT INTO rsvps (host_id, session_id, rsvp_time) VALUES ($1, $2, NOW())', [invite.host_id, invite.session_id]);

  // Send a webhook to Google Hangouts Link Sharing (GHL) to notify the player of the invitation
  const client = new WebhookClient({ url: process.env.GHL_WEBHOOK_URL });
  await client.send({
    text: `You have been invited to a financial roguelike game on ${session.rows[0].date} at ${session.rows[0].format}. RSVP now!`,
    recipient: {
      id: invite.host_id,
    },
  });

  res.json({
    session: {
      date: session.rows[0].date,
      format: session.rows[0].format,
      hostName: invite.host_name,
    },
    rsvpUrl: `/rsvp/${req.params.token}`,
  });
});

export default router;
