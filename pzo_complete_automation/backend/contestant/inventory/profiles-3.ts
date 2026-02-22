import express from 'express';
import { Router } from 'express';
import { ContestantProfileModel } from '../models/contestant-profile.model';
import { checkAuth } from '../middleware/auth';

const router = Router();
const contestantProfiles = new ContestantProfileModel();

router.get('/', checkAuth, async (req, res) => {
try {
const profiles = await contestantProfiles.getAll(req.query);
res.json(profiles);
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

router.post('/', checkAuth, async (req, res) => {
try {
const profile = await contestantProfiles.create(req.body);
res.json(profile);
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

router.put('/:id', checkAuth, async (req, res) => {
try {
const id = req.params.id;
await contestantProfiles.update(id, req.body);
res.send('Profile updated');
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

router.delete('/:id', checkAuth, async (req, res) => {
try {
const id = req.params.id;
await contestantProfiles.remove(id);
res.send('Profile deleted');
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

export default router;
