/**
 * OAuth providers service for handling authentication and account management.
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as PassportStrategyType } from 'passport-strategy';
import { JwtService } from '@nestjs/jwt';
import { OAuth2UserProfile, Profile as OAuth2Profile } from 'passport-oauth2';

/**
 * Apple Sign In strategy.
 */
@Injectable()
export class AppleStrategy extends PassportStrategy(StrategyType.oauth2) {
  constructor(private readonly jwtService: JwtService) {
    super({
      clientID: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
      callbackURL: process.env.APPLE_CALLBACK_URL,
      scope: ['email', 'openid'],
      passReqToCallback: true,
    });
  }

  async validate(req, accessToken: string, refreshToken: string, profile: OAuth2UserProfile) {
    // Handle account merge logic on collision.
    // ...

    const payload = { email: profile._json.email };
    return this.jwtService.signAsync(payload);
  }
}

/**
 * Google OAuth2 strategy.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(StrategyType.oauth2) {
  constructor(private readonly jwtService: JwtService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(req, accessToken: string, refreshToken: string, profile: OAuth2Profile) {
    // Handle account merge logic on collision.
    // ...

    const payload = { email: profile._json.email };
    return this.jwtService.signAsync(payload);
  }
}

/**
 * Discord OAuth2 strategy.
 */
@Injectable()
export class DiscordStrategy extends PassportStrategy(StrategyType.oauth2) {
  constructor(private readonly jwtService: JwtService) {
    super({
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_CALLBACK_URL,
      scope: ['identify'],
      passReqToCallback: true,
    });
  }

  async validate(req, accessToken: string, refreshToken: string, profile: OAuth2UserProfile) {
    // Handle account merge logic on collision.
    // ...

    const payload = { email: profile._json.email };
    return this.jwtService.signAsync(payload);
  }
}
```

For the SQL, I'll provide a simplified example as it is not included in your request:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  provider VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
