/**
 * Cache warming middleware for serving verified pages with CDN hints.
 */
import { Request, Response, NextFunction } from 'express';

interface CacheWarmupData {
  /** The status code to use for the response. */
  statusCode: number;

  /** The TTL (in seconds) for the cache. */
  ttl: number;

  /** The CDN hint headers to include in the response. */
  cdnHintHeaders?: Record<string, string>;
}

/**
 * Warm up the cache for a given URL by sending a GET request and setting appropriate headers.
 * @param url - The URL to warm up.
 * @param data - The data to include in the response.
 */
async function warmUpCache(url: string, data: CacheWarmupData): Promise<void> {
  const options = {
    method: 'GET',
    headers: {
      ...data.cdnHintHeaders,
      'Cache-Control': `public, max-age=${data.ttl}`
    }
  };

  await fetch(url, options);
}

/**
 * Middleware function to handle cache warming for verified pages.
 */
function cacheWarmupMiddleware(verifiedPages: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, next: NextFunction) => {
    const url = req.url;

    if (verifiedPages.includes(url)) {
      const data: CacheWarmupData = {
        statusCode: 200,
        ttl: 60 * 5 // 5 minutes for VERIFIED pages
      };

      await warmUpCache(`https://cdn.example.com${url}`, data);
    }

    next();
  };
}

/**
 * Middleware function to handle cache warming for pending pages with a shorter TTL.
 */
function pendingCacheWarmupMiddleware(pendingPages: string[]): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, next: NextFunction) => {
    const url = req.url;

    if (pendingPages.includes(url)) {
      const data: CacheWarmupData = {
        statusCode: 200,
        ttl: 60 // 1 minute for PENDING pages
      };

      await warmUpCache(`https://cdn.example.com${url}`, data);
    }

    next();
  };
}

/**
 * Export the middleware functions for use in the Express application.
 */
export { cacheWarmupMiddleware, pendingCacheWarmupMiddleware };

