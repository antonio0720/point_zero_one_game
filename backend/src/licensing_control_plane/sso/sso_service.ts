/**
 * SSO Service for Point Zero One Digital's financial roguelike game
 */

import express from 'express';
import passport from 'passport';
import { Strategy as OIDCStrategy, ExtractJwt, StrategyOptions } from 'passport-oidc';
import { Strategy as SAMLStrategy, StrategyOptions as SAMLOptions } from 'passport-saml';

// Import custom types and interfaces
import User from '../user/user.model';
import AssertionMapping from './assertion_mapping.model';

const ssoRouter = express.Router();

// OIDC Strategy configuration
const oidcOptions: StrategyOptions = {
  clientID: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  callbackURL: '/auth/callback',
  scope: ['openid', 'profile', 'email'],
  issuer: process.env.OIDC_ISSUER,
};

// SAML Strategy configuration
const samlOptions: SAMLOptions = {
  entryPointURL: process.env.SAML_ENTRY_POINT,
  identityProviderURL: process.env.SAML_IDENTITY_PROVIDER,
  cert: Buffer.from(process.env.SAML_CERT, 'base64'),
  federationNameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
};

passport.use(new OIDCStrategy(oidcOptions));
passport.use(new SAMLStrategy(samlOptions));

// Middleware to authenticate users using Passport.js
function authRequired(req, res, next) {
  passport.authenticate('oidc', { session: false })(req, res, next);
}

// Routes for institution portal login flows
ssoRouter.get('/login', (req, res) => {
  // Redirect to OIDC or SAML provider for authentication
});

ssoRouter.get('/callback', passport.authenticate('oidc'), async (req, res) => {
  const assertionMapping = await AssertionMapping.findOne({ user: req.user });
  if (!assertionMapping) {
    // Create new assertion mapping for the user
    const newAssertionMapping = new AssertionMapping({ user: req.user });
    await newAssertionMapping.save();
  }

  res.redirect('/institution_portal');
});

// Export public symbols
export { ssoRouter, authRequired };
