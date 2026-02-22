import { Router } from 'express';
import { Request, Response } from 'express';
import { Cosmetic } from './models/cosmetic';
import { User } from './models/user';
import { LeaderboardService } from './services/leaderboard-service';

const router = Router();
const leaderboardService = new LeaderboardService();

// Create a user
router.post('/users', async (req: Request, res: Response) => {
const user = await User.create(req.body);
res.json(user);
});

// Update a user's score
router.put('/users/:id/score', async (req: Request, res: Response) => {
const userId = req.params.id;
const newScore = req.body.score;

await User.update({ score: newScore }, { where: { id: userId } });
const updatedUser = await User.findByPk(userId);
res.json(updatedUser);
});

// Get user leaderboard
router.get('/users/leaderboard', async (req: Request, res: Response) => {
const users = await leaderboardService.getLeaderboard();
res.json(users);
});

// Purchase a cosmetic item for a user
router.post('/users/:id/purchases', async (req: Request, res: Response) => {
const userId = req.params.id;
const cosmeticId = req.body.cosmeticId;

await User.increment('score', { by: 10 }, { where: { id: userId } }); // Adjust score for the purchase cost
const user = await User.findByPk(userId);

await Cosmetic.create({ userId, cosmeticId });
res.json(user);
});
