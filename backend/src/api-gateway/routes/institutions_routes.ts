///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/api-gateway/routes/institutions_routes.ts

import express from 'express';
import Joi from 'joi';
import { AuthMiddleware } from '../auth/auth.middleware';
import {
  InstitutionUpdateInput,
  PgInstitutionsService,
} from '../services/institutions.service';

const router = express.Router();
const institutionsService = new PgInstitutionsService();

type InstitutionRouteParams = {
  id: string | string[];
};

const updateInstitutionSchema = Joi.object<InstitutionUpdateInput>({
  name: Joi.string().trim().min(1).max(255),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(2)
    .max(120),
  status: Joi.string().valid('active', 'inactive', 'archived'),
}).min(1);

function getSingleRouteParam(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].length > 0
      ? value[0]
      : null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseInstitutionId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

router.get(
  '/:id',
  AuthMiddleware<InstitutionRouteParams>(async (req, res) => {
    try {
      const rawInstitutionId = getSingleRouteParam(req.params.id);
      const institutionId = rawInstitutionId
        ? parseInstitutionId(rawInstitutionId)
        : null;

      if (!institutionId) {
        res.status(400).json({
          ok: false,
          error: 'invalid_institution_id',
        });
        return;
      }

      const institution = await institutionsService.getInstitutionById(
        institutionId,
        req.identityId,
      );

      if (!institution) {
        res.status(404).json({
          ok: false,
          error: 'institution_not_found',
        });
        return;
      }

      res.status(200).json({
        ok: true,
        institution,
      });
    } catch (error) {
      console.error('institutions_routes:get', error);
      res.status(500).json({
        ok: false,
        error: 'internal_server_error',
      });
    }
  }),
);

router.put(
  '/:id',
  AuthMiddleware<InstitutionRouteParams>(async (req, res) => {
    try {
      const rawInstitutionId = getSingleRouteParam(req.params.id);
      const institutionId = rawInstitutionId
        ? parseInstitutionId(rawInstitutionId)
        : null;

      if (!institutionId) {
        res.status(400).json({
          ok: false,
          error: 'invalid_institution_id',
        });
        return;
      }

      const { value, error } = updateInstitutionSchema.validate(
        req.body ?? {},
        {
          abortEarly: false,
          stripUnknown: true,
        },
      );

      if (error) {
        res.status(400).json({
          ok: false,
          error: 'invalid_request_body',
          details: error.details.map((detail) => detail.message),
        });
        return;
      }

      const updatedInstitution =
        await institutionsService.updateInstitutionById(
          institutionId,
          value as InstitutionUpdateInput,
          req.identityId,
        );

      if (!updatedInstitution) {
        res.status(404).json({
          ok: false,
          error: 'institution_not_found',
        });
        return;
      }

      res.status(200).json({
        ok: true,
        institution: updatedInstitution,
      });
    } catch (error) {
      console.error('institutions_routes:put', error);
      res.status(500).json({
        ok: false,
        error: 'internal_server_error',
      });
    }
  }),
);

router.delete(
  '/:id',
  AuthMiddleware<InstitutionRouteParams>(async (req, res) => {
    try {
      const rawInstitutionId = getSingleRouteParam(req.params.id);
      const institutionId = rawInstitutionId
        ? parseInstitutionId(rawInstitutionId)
        : null;

      if (!institutionId) {
        res.status(400).json({
          ok: false,
          error: 'invalid_institution_id',
        });
        return;
      }

      const deletedCount = await institutionsService.deleteInstitutionById(
        institutionId,
        req.identityId,
      );

      if (deletedCount === 0) {
        res.status(404).json({
          ok: false,
          error: 'institution_not_found',
        });
        return;
      }

      res.status(200).json({
        ok: true,
        message: 'Institution deleted successfully',
      });
    } catch (error) {
      console.error('institutions_routes:delete', error);
      res.status(500).json({
        ok: false,
        error: 'internal_server_error',
      });
    }
  }),
);

export { router as institutionsRoutes };
export default router;