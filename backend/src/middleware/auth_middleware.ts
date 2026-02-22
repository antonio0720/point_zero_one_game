/**
 * Auth Middleware for Point Zero One Digital's financial roguelike game.
 * Verifies JWT, attaches identity and device trust to request context, handles guests and authenticated users, and rate-limits by identity tier.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { DeviceTrustService } from '../services/deviceTrustService';
import { IdentityService } from '../services/identityService';
import { RateLimitService } from '../services/rateLimitService';

export const authMiddleware = (app: express.Express) => {
  const deviceTrustService = new DeviceTrustService();
  const identityService = new IdentityService();
  const rateLimitService = new RateLimitService();

  app.use(async (req, res, next) => {
    // Extract and verify JWT from authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).send('Unauthorized');
    }

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.identityId = decoded.identityId;

      // Check if the user is a guest or authenticated and update device trust
      const identity = await identityService.getById(req.identityId);
      if (identity) {
        req.isAuthenticated = true;
        await deviceTrustService.incrementDeviceTrust(identity.deviceId);
      } else {
        req.isGuest = true;
      }

      // Rate limit by identity tier
      const rateLimitResult = await rateLimitService.checkRateLimit(req.identityId);
      if (!rateLimitResult.success) {
        return res.status(429).send('Too Many Requests');
      }

      next();
    } catch (error) {
      console.error(`Error in authMiddleware: ${error}`);
      return res.status(401).send('Unauthorized');
    }
  });
};
