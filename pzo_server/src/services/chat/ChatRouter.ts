/**
 * ChatRouter.ts
 * HTTP + WS endpoints for WAR_ALERT broadcast and War Room policy.
 * Covers: T194 (payload endpoints), T198 (load test endpoint)
 */

import { ChatService } from './ChatService';

// ─── Types (Express-compatible, no direct import needed) ──────────────────────

export interface Request {
  params: Record<string, string>;
  body:   Record<string, unknown>;
  query:  Record<string, string>;
  actor?: { playerId: string; allianceId: string; rank: string };
}

export interface Response {
  status(code: number): Response;
  json(body: unknown): void;
}

export type NextFn = (err?: Error) => void;
export type Handler = (req: Request, res: Response, next: NextFn) => Promise<void>;

// ─── ChatRouter ───────────────────────────────────────────────────────────────

export class ChatRouter {
  constructor(
    private readonly chatService: ChatService,
    private readonly featureFlags: { warEnabled: boolean; loadTestEnabled: boolean },
  ) {}

  // POST /api/wars/:warId/alert
  broadcastWarAlert(): Handler {
    return async (req, res, next) => {
      try {
        if (!this.featureFlags.warEnabled) {
          res.status(503).json({ code: 'FEATURE_DISABLED', message: 'War system is disabled.' });
          return;
        }

        const { warId } = req.params;
        const {
          attackerAllianceId,
          defenderAllianceId,
          phase,
          phaseEndsAt,
          attackerPoints = 0,
          defenderPoints = 0,
          proofHash,
        } = req.body as {
          attackerAllianceId: string;
          defenderAllianceId: string;
          phase: string;
          phaseEndsAt: string;
          attackerPoints?: number;
          defenderPoints?: number;
          proofHash?: string;
        };

        if (!attackerAllianceId || !defenderAllianceId || !phase || !phaseEndsAt) {
          res.status(400).json({ code: 'VALIDATION', message: 'Missing required fields.' });
          return;
        }

        const result = await this.chatService.broadcastWarAlert(
          warId,
          attackerAllianceId,
          defenderAllianceId,
          phase as import('./ChatService').WarPhase,
          new Date(phaseEndsAt),
          Number(attackerPoints),
          Number(defenderPoints),
          proofHash as string | undefined,
        );

        res.status(200).json({ ok: true, result });
      } catch (err) {
        next(err as Error);
      }
    };
  }

  // POST /api/wars/:warId/system-message
  publishWarSystemMessage(): Handler {
    return async (req, res, next) => {
      try {
        const { warId } = req.params;
        const { subtype, body, meta } = req.body as {
          subtype: 'WAR_STARTED' | 'ONE_HOUR_WARNING' | 'SETTLEMENT_STARTED' | 'WAR_OUTCOME';
          body: string;
          meta?: Record<string, unknown>;
        };

        if (!subtype || !body) {
          res.status(400).json({ code: 'VALIDATION', message: 'subtype and body required.' });
          return;
        }

        const message = await this.chatService.publishWarRoomSystemMessage(
          warId, subtype, body, meta,
        );

        res.status(200).json({ ok: true, message });
      } catch (err) {
        next(err as Error);
      }
    };
  }

  // POST /api/internal/load-test/war-fanout  — staging only
  runLoadTest(): Handler {
    return async (req, res, next) => {
      try {
        if (!this.featureFlags.loadTestEnabled) {
          res.status(403).json({ code: 'FORBIDDEN', message: 'Load test not enabled.' });
          return;
        }

        const {
          concurrentWars    = 10,
          membersPerAlliance = 50,
          durationMs        = 30_000,
        } = req.body as {
          concurrentWars?: number;
          membersPerAlliance?: number;
          durationMs?: number;
        };

        const stats = await this.chatService.runWarFanoutLoadTest({
          concurrentWars:    Math.min(concurrentWars, 100),  // cap at 100 in test env
          membersPerAlliance: Math.min(membersPerAlliance, 500),
          durationMs:         Math.min(durationMs, 120_000),
        });

        res.status(200).json({ ok: true, stats });
      } catch (err) {
        next(err as Error);
      }
    };
  }
}
