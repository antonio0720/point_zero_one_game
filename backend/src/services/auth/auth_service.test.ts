import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../auth_service';
import { User, Guest, AccountUpgrade, JwtPayload, DeviceTrustLevel } from '../../models';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuthProvider } from '../../oauth/oauth_provider';

let authService: AuthService;
let user: User;
let guest: Guest;
let accountUpgrade: AccountUpgrade;
let jwtSecret: string;
let deviceId: string;
let oauthProvider: OAuthProvider;

beforeEach(() => {
  authService = new AuthService();
  jwtSecret = crypto.randomBytes(32).toString('hex');
  authService.setJwtSecret(jwtSecret);
  deviceId = crypto.randomBytes(16).toString('hex');
  oauthProvider = new OAuthProvider();

  user = {
    id: 1,
    username: 'testUser',
    password: 'testPassword',
    email: 'test@example.com',
    deviceTrustLevel: DeviceTrustLevel.LOW,
    devices: [deviceId],
  };

  guest = {
    id: 0,
    username: 'guest',
    password: undefined,
    email: undefined,
    deviceTrustLevel: DeviceTrustLevel.UNKNOWN,
    devices: [],
  };

  accountUpgrade = {
    userId: user.id,
    guestId: guest.id,
    runs: 10,
  };
});

afterEach(() => {
  // Clear any side effects here
});

describe('Guest creation', () => {
  it('creates a new guest account', async () => {
    const result = await authService.createGuest();
    expect(result).toEqual(guest);
  });

  it('does not allow creating a guest with an existing user account', async () => {
    await authService.createUser(user);
    const result = authService.createGuest();
    expect(result).rejects.toThrow('A user account already exists for this email');
  });
});

describe('Account upgrade preserves runs', () => {
  it('upgrades a guest account to a user account with the correct number of runs', async () => {
    const upgradedUser = await authService.upgradeGuest(accountUpgrade);
    expect(upgradedUser.runs).toEqual(accountUpgrade.runs);
  });
});

describe('JWT expiry/refresh', () => {
  it('generates a JWT with the correct payload and secret', async () => {
    const jwtPayload: JwtPayload = { userId: user.id, deviceId };
    const token = authService.createJwt(jwtPayload);
    expect(jwt.verify(token, jwtSecret)).toEqual(jwtPayload);
  });

  it('refreshes a JWT with the correct payload and secret', async () => {
    const jwtPayload: JwtPayload = { userId: user.id, deviceId };
    const token = authService.createJwt(jwtPayload);
    const refreshedToken = authService.refreshJwt(token);
    expect(jwt.verify(refreshedToken, jwtSecret)).toEqual(jwtPayload);
  });
});

describe('Device trust thresholds', () => {
  it('increases device trust level when a user logs in from the device', async () => {
    await authService.login(user.username, user.password, deviceId);
    const updatedUser = await authService.getUserById(user.id);
    expect(updatedUser.deviceTrustLevel).toEqual(DeviceTrustLevel.MEDIUM);
  });

  it('decreases device trust level when a user logs in from a different device', async () => {
    const newDeviceId = crypto.randomBytes(16).toString('hex');
    await authService.login(user.username, user.password, deviceId);
    await authService.login(user.username, user.password, newDeviceId);
    const updatedUser = await authService.getUserById(user.id);
    expect(updatedUser.deviceTrustLevel).toEqual(DeviceTrustLevel.LOW);
  });
});

describe('OAuth normalization', () => {
  it('normalizes OAuth provider names to lowercase', () => {
    const oauthProviderNames = [
      'Google',
      'Facebook',
      'Twitter',
      'Microsoft',
    ].map((provider) => authService.normalizeOAuthProvider(provider));
    expect(oauthProviderNames).toEqual([
      OAuthProvider.GOOGLE,
      OAuthProvider.FACEBOOK,
      OAuthProvider.TWITTER,
      OAuthProvider.MICROSOFT,
    ]);
  });
});
