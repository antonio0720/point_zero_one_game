/**
 * SSO (OIDC + SAML) abstraction, identity binding, and tenant routing by domain.
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as PassportStrategyType } from 'passport-jwt';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { Domain } from '../entities/domain.entity';
import { Tenant } from '../entities/tenant.entity';

/** OIDC + SAML strategy */
@Injectable()
export class SsoStrategy extends PassportStrategy(Strategy as PassportStrategyType) {
  constructor(private readonly jwtService: JwtService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.SSO_SECRET,
    });
  }

  async validate(payload: any) {
    const user = await User.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new Error('Invalid user');
    }

    const domain = await Domain.findOne({ where: { name: user.domain }, relations: ['tenant'] });
    if (!domain) {
      throw new Error('Invalid domain');
    }

    request.user = user;
    request.domain = domain;
    request.tenant = domain.tenant;

    return user;
  }
}


Also, the SSO_SECRET environment variable should be securely managed in a production environment.
