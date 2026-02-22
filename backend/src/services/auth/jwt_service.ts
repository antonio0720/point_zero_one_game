/**
 * JWT Service for handling access and refresh tokens
 */

import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { RedisService } from '@pointzeroonedigital/nestjs-redis';
import { JWT_SECRET, REFRESH_TOKEN_TTL, ACCESS_TOKEN_TTL } from '../constants';

/**
 * User payload for JWT
 */
interface UserPayload {
  id: string;
  deviceId: string;
}

/**
 * AccessTokenPayload extends UserPayload with expiration time
 */
interface AccessTokenPayload extends UserPayload {
  exp: number;
}

/**
 * RefreshTokenPayload extends UserPayload with refresh token and expiration time
 */
interface RefreshTokenPayload extends UserPayload {
  refreshToken: string;
  exp: number;
}

/**
 * JWT Service for handling access and refresh tokens
 */
@Injectable()
export class JwtService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Generate access token with given user payload and TTL
   * @param payload User payload
   */
  generateAccessToken(payload: UserPayload): string {
    const accessToken = jwt.sign(this.createAccessTokenPayload(payload), JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
    this.rotateAndRevokeTokens(payload.id, 'access');
    return accessToken;
  }

  /**
   * Generate refresh token with given user payload and TTL
   * @param payload User payload
   */
  generateRefreshToken(payload: UserPayload): string {
    const refreshToken = jwt.sign(this.createRefreshTokenPayload(payload), JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
    this.storeDeviceBoundRefreshToken(payload.id, payload.deviceId, refreshToken);
    return refreshToken;
  }

  /**
   * Validate access token and return user payload
   * @param token Access token
   */
  validateAccessToken(token: string): UserPayload {
    const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
    this.validateAndRevokeTokens(decoded.id, 'access', decoded.exp);
    return decoded;
  }

  /**
   * Validate refresh token and return user payload
   * @param token Refresh token
   */
  validateRefreshToken(token: string): UserPayload {
    const decoded = jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;
    this.validateAndRevokeTokens(decoded.id, 'refresh', decoded.exp);
    return decoded;
  }

  /**
   * Create access token payload with given user payload and expiration time
   * @param payload User payload
   */
  private createAccessTokenPayload(payload: UserPayload): AccessTokenPayload {
    const now = Math.floor(Date.now() / 1000);
    return { ...payload, exp: now + ACCESS_TOKEN_TTL };
  }

  /**
   * Create refresh token payload with given user payload, refresh token, and expiration time
   * @param payload User payload
   */
  private createRefreshTokenPayload(payload: UserPayload): RefreshTokenPayload {
    const now = Math.floor(Date.now() / 1000);
    return { ...payload, refreshToken: '', exp: now + REFRESH_TOKEN_TTL };
  }

  /**
   * Store device-bound refresh token in Redis
   * @param userId User ID
   * @param deviceId Device ID
   * @param refreshToken Refresh token
   */
  private storeDeviceBoundRefreshToken(userId: string, deviceId: string, refreshToken: string) {
    this.redis.set(`refresh_token:${userId}:${deviceId}`, refreshToken);
  }

  /**
   * Rotate and revoke all access and refresh tokens for given user ID
   * @param userId User ID
   * @param tokenType Token type ('access' or 'refresh')
   */
  private rotateAndRevokeTokens(userId: string, tokenType: 'access' | 'refresh') {
    this.rotateTokens(userId, tokenType);
    this.revokeTokens(userId, tokenType);
  }

  /**
   * Rotate tokens for given user ID and token type
   * @param userId User ID
   * @param tokenType Token type ('access' or 'refresh')
   */
  private rotateTokens(userId: string, tokenType: 'access' | 'refresh') {
    // Implement rotation logic here
  }

  /**
   * Revoke tokens for given user ID and token type
   * @param userId User ID
   * @param tokenType Token type ('access' or 'refresh')
   */
  private revokeTokens(userId: string, tokenType: 'access' | 'refresh') {
    // Implement revocation logic here
  }

  /**
   * Validate tokens for given user ID, token type, and expiration time
   * @param userId User ID
   * @param tokenType Token type ('access' or 'refresh')
   * @param exp Expiration time
   */
  private validateAndRevokeTokens(userId: string, tokenType: 'access' | 'refresh', exp: number) {
    if (Date.now() / 1000 > exp) {
      this.revokeTokens(userId, tokenType);
      throw new Error('Token has expired');
    }
  }
}
