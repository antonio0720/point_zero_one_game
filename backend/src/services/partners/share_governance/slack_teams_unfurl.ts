/**
 * Slack Teams Unfurl Service
 */

import axios from 'axios';
import { Request, Response } from 'express';

/**
 * Interface for URL metadata response
 */
interface MetadataResponse {
  title?: string;
  description?: string;
  image_url?: string;
}

/**
 * Fetches and returns the Open Graph (OG) and deep link metadata for a given Point Zero One Game URL.
 * @param url - The URL to fetch metadata for.
 * @returns The fetched metadata as an object or null if the URL is not valid.
 */
function getMetadata(url: string): MetadataResponse | null {
  // Implement the logic to fetch and parse the OG and deep link metadata using axios and a library like `og-scraper` or `puppeteer`.
}

/**
 * Handles incoming Slack/Teams unfurl requests.
 * @param req - The incoming request.
 * @param res - The response to send back.
 */
export function handleUnfurl(req: Request, res: Response) {
  const url = req.body.url;

  if (!url || !/^https?:\/\/pointzeroonegame\.com/.test(url)) {
    res.status(400).send({ error: 'Invalid URL' });
    return;
  }

  const metadata = getMetadata(url);

  if (!metadata) {
    res.status(200).send({ original_url: url });
    return;
  }

  res.status(200).json({
    original_url: url,
    title: metadata.title || '',
    text: metadata.description || '',
    image_url: metadata.image_url || '',
  });
}
