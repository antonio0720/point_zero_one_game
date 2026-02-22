/**
 * RunExplorer routes for API Gateway (Envoy/Connect)
 */

import express from 'express';
import { CacheControl, ServerResponse } from 'cache-control';
import { Router } from '@tko/router';

const runExplorerRoutes = express.Router();

// Define the explorer pages cache duration (in seconds)
const EXPLORER_CACHE_DURATION = 60 * 5; // 5 minutes

/**
 * Middleware to apply caching headers for explorer pages
 */
function applyCachingHeaders(req: express.Request, res: ServerResponse) {
  CacheControl({ maxAge: EXPLORER_CACHE_DURATION }).handle(res);
}

// Mount the RunExplorer routes and apply caching headers
runExplorerRoutes.get('/explorer/:page', applyCachingHeaders, (req, res) => {
  // Handle the request for a specific explorer page
});

export default runExplorerRoutes;
