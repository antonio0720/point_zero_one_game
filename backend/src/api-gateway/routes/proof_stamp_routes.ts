/**
 * Proof Stamp Routes for API Gateway
 */

import express from 'express';
import { Request, Response } from 'express';
import { AuthPanelHandler, StampLookupHandler } from './handlers';

const router = express.Router();

// Auth Panel Route
router.get('/auth-panel', AuthPanelHandler);

// Stamp Lookup Route
router.get('/stamp/:id', StampLookupHandler);

export { router };

Handlers (AuthPanelHandler and StampLookupHandler) should be implemented separately, following the same strict TypeScript rules and including JSDoc for their functions.
