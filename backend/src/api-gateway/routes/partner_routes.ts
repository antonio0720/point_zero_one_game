/**
 * Partner routes for Point Zero One Digital's financial roguelike game.
 */

import express from 'express';
import { Request, Response } from 'express';
import { verifyToken } from '../auth/jwt';
import { PartnerService } from '../services/partner.service';

const router = express.Router();
const partnerService = new PartnerService();

/**
 * Middleware to enforce tenant routing by domain.
 */
function tenantRoutingMiddleware(req: Request, res: Response, next: Function) {
  // Implement the logic for tenant routing based on the domain of the request.
  next();
}

/**
 * Routes for partner management.
 */
router.get('/', verifyToken, async (req: Request, res: Response) => {
  const partners = await partnerService.getPartners(req.user!.tenantId);
  res.json(partners);
});

router.post('/', verifyToken, async (req: Request, res: Response) => {
  const partner = await partnerService.createPartner(req.body, req.user!.tenantId);
  res.status(201).json(partner);
});

router.put('/:id', verifyToken, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const updatedPartner = await partnerService.updatePartner(id, req.body);
  res.json(updatedPartner);
});

router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await partnerService.deletePartner(id);
  res.status(204).send();
});

/**
 * Export the partner routes.
 */
export { router, tenantRoutingMiddleware };
