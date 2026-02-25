/**
 * Monetization Routes for API Gateway
 */

import express from 'express';
import { OfferPolicy } from '../services/offer_policy';
import { AuditService } from '../services/audit';
import { StoreService } from '../services/store';
import { OffersService } from '../services/offers';

const router = express.Router();

// Define the store endpoint
router.get('/store', async (req, res) => {
  try {
    const offers = await StoreService.getOffers();
    // Enforce offer policy
    const validOffers = OfferPolicy.validate(offers);
    res.json(validOffers);
  } catch (error) {
    AuditService.logError(error);
    res.status(500).send('Internal Server Error');
  }
});

// Define the offers endpoint
router.get('/offers', async (req, res) => {
  try {
    const offers = await OffersService.getOffers();
    // Enforce offer policy
    const validOffers = OfferPolicy.validate(offers);
    res.json(validOffers);
  } catch (error) {
    AuditService.logError(error);
    res.status(500).send('Internal Server Error');
  }
});

export { router };
