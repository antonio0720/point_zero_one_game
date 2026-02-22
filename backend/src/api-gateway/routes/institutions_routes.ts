/**
 * Institutions Routes for API Gateway
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../auth/jwt-utils';
import InstitutionsService from '../services/institutions-service';

const router = express.Router();
const institutionsService = new InstitutionsService();

// Auth required routes for institutions
router.get('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decodedToken = jwt.verify(token as string, process.env.SECRET_KEY);
    const userId = decodedToken.id;

    const institutionId = parseInt(req.params.id);
    const institution = await institutionsService.getInstitutionById(institutionId, userId);

    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    res.json(institution);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decodedToken = jwt.verify(token as string, process.env.SECRET_KEY);
    const userId = decodedToken.id;

    const institutionId = parseInt(req.params.id);
    const updatedInstitution = await institutionsService.updateInstitutionById(institutionId, req.body, userId);

    if (!updatedInstitution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    res.json(updatedInstitution);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decodedToken = jwt.verify(token as string, process.env.SECRET_KEY);
    const userId = decodedToken.id;

    const institutionId = parseInt(req.params.id);
    const deletedInstitutionCount = await institutionsService.deleteInstitutionById(institutionId, userId);

    if (deletedInstitutionCount === 0) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    res.json({ message: 'Institution deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export { router as institutionsRoutes };
