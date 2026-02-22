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
```

For SQL, I'll provide the schema for the Offers and OfferPolicy tables:

```sql
-- Offers Table
CREATE TABLE IF NOT EXISTS offers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  UNIQUE INDEX offer_name_unique (name)
);

-- OfferPolicy Table
CREATE TABLE IF NOT EXISTS offer_policy (
  id INT PRIMARY KEY AUTO_INCREMENT,
  offer_id INT NOT NULL,
  user_id INT NOT NULL,
  purchased BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (offer_id) REFERENCES offers(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
