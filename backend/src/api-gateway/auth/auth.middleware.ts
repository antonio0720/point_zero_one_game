/**
 * AuthMiddleware — Higher-order function that wraps route handlers.
 * Reads the identity set by the upstream authMiddleware (src/middleware/auth_middleware.ts)
 * and rejects the request if the user is not authenticated.
 *
 * Usage:
 *   AuthMiddleware<RouteParams>(async (req, res) => { ... })
 *
 * Inside handler:
 *   req.identityId — the verified player ID.
 */

import type { NextFunction, Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

declare global {
  namespace Express {
    interface Request {
      identityId?: string;
      isAuthenticated?: boolean;
      isGuest?: boolean;
      authScopes?: readonly string[];
      authRoles?: readonly string[];
    }

    interface Locals {
      auth?: {
        identityId: string;
        isAuthenticated: true;
        isGuest: false;
        scopes: readonly string[];
        roles: readonly string[];
      };
    }
  }
}

export type AuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  identityId: string;
  isAuthenticated: true;
  isGuest?: false;
  authScopes?: readonly string[];
  authRoles?: readonly string[];
};

export type AuthenticatedRouteHandler<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  TReq extends AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery> = AuthenticatedRequest<
    P,
    ResBody,
    ReqBody,
    ReqQuery
  >,
> = (
  req: TReq,
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<unknown> | unknown;

export type AuthMiddlewareOptions<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  TReq extends AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery> = AuthenticatedRequest<
    P,
    ResBody,
    ReqBody,
    ReqQuery
  >,
> = {
  requireScopes?: readonly string[];
  requireRoles?: readonly string[];
  authorize?: (req: TReq, res: Response<ResBody>) => Promise<boolean> | boolean;
  onUnauthorized?: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
  ) => void;
  onForbidden?: (req: TReq, res: Response<ResBody>) => void;
  exposeAuthOnLocals?: boolean;
};

type ErrorWithStatus = Error & {
  status?: number;
  statusCode?: number;
  code?: string;
};

const DEFAULT_UNAUTHORIZED_BODY = Object.freeze({
  ok: false,
  error: 'unauthorized',
  code: 'AUTH_UNAUTHORIZED',
});

const DEFAULT_FORBIDDEN_BODY = Object.freeze({
  ok: false,
  error: 'forbidden',
  code: 'AUTH_FORBIDDEN',
});

function getRequestId(req: Request): string | null {
  const value = req.headers['x-request-id'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function respondUnauthorized(
  req: Request,
  res: Response,
): void {
  if (res.headersSent) {
    return;
  }

  const requestId = getRequestId(req);

  res.status(401).json({
    ...DEFAULT_UNAUTHORIZED_BODY,
    ...(requestId ? { requestId } : {}),
  });
}

function respondForbidden(
  req: AuthenticatedRequest,
  res: Response,
): void {
  if (res.headersSent) {
    return;
  }

  const requestId = getRequestId(req);

  res.status(403).json({
    ...DEFAULT_FORBIDDEN_BODY,
    ...(requestId ? { requestId } : {}),
  });
}

function normalizeClaims(values?: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const unique = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = value.trim();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Object.freeze([...unique]);
}

function hasAllClaims(
  actual: readonly string[] | undefined,
  required: readonly string[] | undefined,
): boolean {
  if (!required || required.length === 0) {
    return true;
  }

  const actualSet = new Set(normalizeClaims(actual));

  for (const claim of normalizeClaims(required)) {
    if (!actualSet.has(claim)) {
      return false;
    }
  }

  return true;
}

export function isAuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
>(
  req: Request<P, ResBody, ReqBody, ReqQuery>,
): req is AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery> {
  return (
    req.isAuthenticated === true &&
    typeof req.identityId === 'string' &&
    req.identityId.trim().length > 0
  );
}

export function assertAuthenticated<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
>(
  req: Request<P, ResBody, ReqBody, ReqQuery>,
): asserts req is AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery> {
  if (!isAuthenticatedRequest(req)) {
    const error = new Error('Request is not authenticated') as ErrorWithStatus;
    error.name = 'AuthenticationError';
    error.code = 'AUTH_UNAUTHORIZED';
    error.status = 401;
    throw error;
  }
}

function bindAuthLocals<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
>(
  req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
): void {
  res.locals.auth = {
    identityId: req.identityId,
    isAuthenticated: true,
    isGuest: false,
    scopes: normalizeClaims(req.authScopes),
    roles: normalizeClaims(req.authRoles),
  };
}

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

export function AuthMiddleware<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  TReq extends AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery> = AuthenticatedRequest<
    P,
    ResBody,
    ReqBody,
    ReqQuery
  >,
>(
  handler: AuthenticatedRouteHandler<P, ResBody, ReqBody, ReqQuery, TReq>,
  options: AuthMiddlewareOptions<P, ResBody, ReqBody, ReqQuery, TReq> = {},
): (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<void> {
  const {
    requireScopes,
    requireRoles,
    authorize,
    onUnauthorized = respondUnauthorized as (
      req: Request<P, ResBody, ReqBody, ReqQuery>,
      res: Response<ResBody>,
    ) => void,
    onForbidden = respondForbidden as (req: TReq, res: Response<ResBody>) => void,
    exposeAuthOnLocals = true,
  } = options;

  return async (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!isAuthenticatedRequest(req)) {
        onUnauthorized(req, res);
        return;
      }

      const authenticatedReq = req as TReq;

      if (!hasAllClaims(authenticatedReq.authScopes, requireScopes)) {
        onForbidden(authenticatedReq, res);
        return;
      }

      if (!hasAllClaims(authenticatedReq.authRoles, requireRoles)) {
        onForbidden(authenticatedReq, res);
        return;
      }

      if (exposeAuthOnLocals) {
        bindAuthLocals(authenticatedReq, res);
      }

      if (authorize) {
        const allowed = await authorize(authenticatedReq, res);
        if (!allowed) {
          onForbidden(authenticatedReq, res);
          return;
        }
      }

      await Promise.resolve(handler(authenticatedReq, res, next));
    } catch (error: unknown) {
      if (res.headersSent) {
        next(error);
        return;
      }

      if (isErrorLike(error)) {
        next(error);
        return;
      }

      const wrapped = new Error(
        'Unhandled non-error thrown from authenticated route',
      ) as ErrorWithStatus;
      wrapped.name = 'AuthMiddlewareUnhandledThrow';
      wrapped.code = 'AUTH_HANDLER_THROW';
      wrapped.statusCode = 500;
      next(wrapped);
    }
  };
}