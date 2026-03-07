/**
 * Creator Economy Routes for API Gateway
 * backend/src/api-gateway/routes/creator_economy_routes.ts
 *
 * Clean-room rewrite:
 * - no Sequelize-style ../models import
 * - no rate-limiter-flexible dependency
 * - typed Express handlers
 * - JWT auth stored in res.locals.auth
 * - route depends on a service contract, not a DB model layer
 */

import express, { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface CreatorRecord {
  id: string;
  displayName: string;
  slug: string;
  bio?: string | null;
  status: 'active' | 'paused' | 'banned';
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  creatorId: string;
  userId: string;
  tier: string;
  status: 'active' | 'paused' | 'canceled';
  startedAt: string;
  updatedAt: string;
}

export interface TransactionRecord {
  id: string;
  creatorId: string;
  userId: string;
  amountMinor: number;
  currency: string;
  kind: 'tip' | 'purchase' | 'subscription';
  status: 'pending' | 'settled' | 'failed' | 'refunded';
  createdAt: string;
}

export interface CreatorEconomyRouteDeps {
  listCreators(): Promise<CreatorRecord[]>;
  getCreatorById(id: string): Promise<CreatorRecord | null>;
  createSubscription(input: {
    creatorId: string;
    userId: string;
    tier: string;
  }): Promise<SubscriptionRecord>;
  createTransaction(input: {
    creatorId: string;
    userId: string;
    amountMinor: number;
    currency: string;
    kind: 'tip' | 'purchase' | 'subscription';
  }): Promise<TransactionRecord>;
}

type AuthClaims = JwtPayload & {
  sub?: string;
  userId?: string;
  role?: string;
  roles?: string[];
};

const createSubscriptionSchema = Joi.object({
  creatorId: Joi.string().trim().min(1).required(),
  userId: Joi.string().trim().min(1).required(),
  tier: Joi.string().trim().min(1).default('standard'),
});

const createTransactionSchema = Joi.object({
  creatorId: Joi.string().trim().min(1).required(),
  userId: Joi.string().trim().min(1).required(),
  amountMinor: Joi.number().integer().positive().required(),
  currency: Joi.string().trim().length(3).uppercase().default('USD'),
  kind: Joi.string().valid('tip', 'purchase', 'subscription').default('tip'),
});

function createFixedWindowLimiter(options: {
  windowMs: number;
  max: number;
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return function rateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const now = Date.now();
    const key =
      req.ip ||
      req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      'unknown';

    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (current.count >= options.max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'too_many_requests',
        message: 'Too many requests.',
        retryAfterSeconds,
      });
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
}

function requireJwt(req: Request, res: Response, next: NextFunction): void {
  const rawHeader =
    req.header('authorization') ??
    req.header('Authorization') ??
    req.header('x-auth-token');

  if (!rawHeader) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Missing authentication token.',
    });
    return;
  }

  const token = rawHeader.startsWith('Bearer ')
    ? rawHeader.slice('Bearer '.length).trim()
    : rawHeader.trim();

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({
      error: 'server_misconfigured',
      message: 'JWT secret is not configured.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthClaims;
    res.locals.auth = decoded as any;
    next();
  } catch {
    res.status(401).json({
      error: 'invalid_token',
      message: 'Invalid authentication token.',
    });
  }
}

export function createCreatorEconomyRoutes(
  deps: CreatorEconomyRouteDeps,
): express.Router {
  const router = express.Router();
  const writeLimiter = createFixedWindowLimiter({
    windowMs: 60_000,
    max: 10,
  });

  router.get('/creators', requireJwt, async (_req, res) => {
    try {
      const creators = await deps.listCreators();
      res.status(200).json({ items: creators });
    } catch (error) {
      console.error('creator_economy_routes:listCreators', error);
      res.status(500).json({
        error: 'internal_error',
        message: 'Unable to list creators.',
      });
    }
  });

  router.get('/creators/:id', requireJwt, async (req, res) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        res.status(400).json({
          error: 'invalid_request',
          message: 'Creator id is required.',
        });
        return;
      }
      const creator = await deps.getCreatorById(id);
      if (!creator) {
        res.status(404).json({
          error: 'creator_not_found',
          message: 'Creator not found.',
        });
        return;
      }

      res.status(200).json(creator);
    } catch (error) {
      console.error('creator_economy_routes:getCreatorById', error);
      res.status(500).json({
        error: 'internal_error',
        message: 'Unable to load creator.',
      });
    }
  });

  router.post('/subscriptions', writeLimiter, requireJwt, async (req, res) => {
    const { value, error } = createSubscriptionSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Subscription payload is invalid.',
        details: error.details.map((d) => d.message),
      });
      return;
    }

    try {
      const subscription = await deps.createSubscription({
        creatorId: value.creatorId,
        userId: value.userId,
        tier: value.tier,
      });

      res.status(201).json(subscription);
    } catch (err) {
      console.error('creator_economy_routes:createSubscription', err);
      res.status(500).json({
        error: 'internal_error',
        message: 'Unable to create subscription.',
      });
    }
  });

  router.post('/transactions', writeLimiter, requireJwt, async (req, res) => {
    const { value, error } = createTransactionSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Transaction payload is invalid.',
        details: error.details.map((d) => d.message),
      });
      return;
    }

    try {
      const transaction = await deps.createTransaction({
        creatorId: value.creatorId,
        userId: value.userId,
        amountMinor: value.amountMinor,
        currency: value.currency,
        kind: value.kind,
      });

      res.status(201).json(transaction);
    } catch (err) {
      console.error('creator_economy_routes:createTransaction', err);
      res.status(500).json({
        error: 'internal_error',
        message: 'Unable to create transaction.',
      });
    }
  });

  return router;
}

export default createCreatorEconomyRoutes;