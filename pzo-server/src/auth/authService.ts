/**
 * pzo-server/src/auth/authService.ts
 * Production auth: bcrypt password hashing, JWT access + refresh tokens
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';
import type { Pool } from 'pg';

const BCRYPT_ROUNDS  = 12;
const ACCESS_TTL     = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TokenPayload {
  sub:         string;   // user UUID
  username:    string;
  displayName: string;
  iat?:        number;
  exp?:        number;
}

export interface AuthResult {
  accessToken:  string;
  refreshToken: string;
  user: {
    id:          string;
    username:    string;
    email:       string;
    displayName: string;
    avatarEmoji: string;
    totalRuns:   number;
    bestNetWorth: number;
    totalFreedomRuns: number;
    haterHeat:   number;
  };
}

export class AuthService {
  constructor(private db: Pool) {}

  // ── Register ──────────────────────────────────────────────────────────────

  async register(
    username: string,
    email: string,
    password: string,
    displayName?: string,
  ): Promise<AuthResult> {
    // Normalize
    const uname = username.trim().toLowerCase();
    const mail  = email.trim().toLowerCase();
    const dname = (displayName?.trim() || username).slice(0, 50);

    // Validate
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(uname)) {
      throw new Error('Username must be 3–32 characters: letters, numbers, underscores only.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    // Duplicate check
    const existing = await this.db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [uname, mail]
    );
    if (existing.rowCount! > 0) {
      throw new Error('Username or email already taken.');
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await this.db.query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, display_name, avatar_emoji,
                 total_runs, best_net_worth, total_freedom_runs, hater_heat`,
      [uname, mail, hash, dname]
    );

    const user = result.rows[0];
    return this._mintTokens(user);
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(usernameOrEmail: string, password: string, ip?: string, ua?: string): Promise<AuthResult> {
    const q = usernameOrEmail.trim().toLowerCase();

    const result = await this.db.query(
      `SELECT id, username, email, display_name, avatar_emoji, password_hash,
              total_runs, best_net_worth, total_freedom_runs, hater_heat, is_banned, ban_reason
       FROM users
       WHERE username = $1 OR email = $1`,
      [q]
    );

    if (result.rowCount === 0) {
      throw new Error('Invalid credentials.');
    }

    const user = result.rows[0];
    if (user.is_banned) {
      throw new Error(`Account suspended: ${user.ban_reason || 'contact support'}`);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid credentials.');

    // Update last_login
    await this.db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    return this._mintTokens(user, ip, ua);
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const hash = createHash('sha256').update(refreshToken).digest('hex');

    const result = await this.db.query(
      `SELECT rt.user_id, u.username, u.display_name
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
      [hash]
    );

    if (result.rowCount === 0) throw new Error('Invalid or expired refresh token.');

    const { user_id, username, display_name } = result.rows[0];
    const payload: TokenPayload = { sub: user_id, username, displayName: display_name };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });

    return { accessToken };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    await this.db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash]);
  }

  // ── Verify access token ───────────────────────────────────────────────────

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  }

  // ── Get profile ───────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const result = await this.db.query(
      `SELECT id, username, email, display_name, avatar_emoji, created_at,
              total_runs, best_net_worth, total_freedom_runs, current_streak,
              best_streak, hater_heat, times_sabotaged
       FROM users WHERE id = $1 AND is_active = true AND is_banned = false`,
      [userId]
    );
    if (result.rowCount === 0) throw new Error('User not found.');
    return result.rows[0];
  }

  // ── Update run stats ──────────────────────────────────────────────────────

  async recordRunResult(
    userId: string,
    seed: number,
    ticksSurvived: number,
    finalCash: number,
    finalNetWorth: number,
    finalIncome: number,
    finalExpenses: number,
    outcome: 'FREEDOM' | 'BANKRUPT' | 'TIMEOUT' | 'ABANDONED',
    proofHash: string,
    haterSabotages: number,
  ) {
    await this.db.query(
      `INSERT INTO run_history
         (user_id, seed, ticks_survived, final_cash, final_net_worth, final_income, final_expenses, outcome, proof_hash, hater_sabotages)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [userId, seed, ticksSurvived, finalCash, finalNetWorth, finalIncome, finalExpenses, outcome, proofHash, haterSabotages]
    );

    await this.db.query(
      `UPDATE users SET
         total_runs = total_runs + 1,
         best_net_worth = GREATEST(best_net_worth, $2),
         total_freedom_runs = total_freedom_runs + CASE WHEN $3 = 'FREEDOM' THEN 1 ELSE 0 END,
         current_streak = CASE WHEN $3 = 'FREEDOM' THEN current_streak + 1 ELSE 0 END,
         best_streak = GREATEST(best_streak, CASE WHEN $3 = 'FREEDOM' THEN current_streak + 1 ELSE current_streak END),
         times_sabotaged = times_sabotaged + $4
       WHERE id = $1`,
      [userId, finalNetWorth, outcome, haterSabotages]
    );
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async _mintTokens(user: Record<string, unknown>, ip?: string, ua?: string): Promise<AuthResult> {
    const payload: TokenPayload = {
      sub:         user.id as string,
      username:    user.username as string,
      displayName: user.display_name as string,
    };

    const accessToken  = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
    const rawRefresh   = uuid() + uuid();
    const refreshHash  = createHash('sha256').update(rawRefresh).digest('hex');
    const expiresAt    = new Date(Date.now() + REFRESH_TTL_MS);

    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshHash, expiresAt, ip ?? null, ua ?? null]
    );

    // Clean expired tokens for this user (housekeeping)
    await this.db.query(
      'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()',
      [user.id]
    );

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: {
        id:               user.id as string,
        username:         user.username as string,
        email:            user.email as string,
        displayName:      user.display_name as string,
        avatarEmoji:      user.avatar_emoji as string,
        totalRuns:        user.total_runs as number,
        bestNetWorth:     user.best_net_worth as number,
        totalFreedomRuns: user.total_freedom_runs as number,
        haterHeat:        user.hater_heat as number,
      },
    };
  }
}
