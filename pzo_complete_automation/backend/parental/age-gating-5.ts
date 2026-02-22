import express from 'express';
import passport from 'passport';
import jwtStrategies from './jwt-strategies';
import joi from '@hapi/joi';
import { Request, Response, NextFunction } from 'express';

const router = express.Router();
const MIN_AGE = 18;

// Validate user's age with Joi schema
const ageSchema = joi.object({
birthdate: joi.string().regex(/(\d{4}-\d{2}-\d{2})/).required()
});

router.post('/check-age', passport.authenticate('jwt', { session: false }), async (req: Request, res: Response) => {
const { birthdate } = req.body;
const result = ageSchema.validate({ birthdate });

if (result.error) return res.status(400).send({ error: result.error.message });

const birthDate = new Date(birthdate);
const ageDifferenceInYears = Math.abs(new Date().getFullYear() - birthDate.getFullYear());

if (ageDifferenceInYears < MIN_AGE) {
return res.status(403).send({ error: 'You are not old enough to access this service' });
}

req.user.ageVerified = true;
next();
});

router.get('/profile', passport.authenticate('jwt', { session: false }), (req: Request, res: Response) => {
if (!req.user.ageVerified) return res.status(403).send({ error: 'Your age has not been verified yet' });

const user = req.user;
delete user.password; // For security reasons, remove password from the response
res.json(user);
});

// Initialize JWT strategy with Passport
jwtStrategies.init();

export default router;
