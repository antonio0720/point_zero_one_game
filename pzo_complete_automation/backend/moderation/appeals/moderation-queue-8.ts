import { Router } from 'express';
import UserService from '../services/user-service';
import BanService from '../services/ban-service';
import { Request, Response } from 'express';

const router = Router();
const userService = new UserService();
const banService = new BanService();

router.post('/abuse', async (req: Request, res: Response) => {
const userId = req.body.userId;
const abuseReason = req.body.reason;

try {
await userService.markAsAbused(userId, abuseReason);
res.status(200).send({ message: 'User abuse report submitted successfully.' });
} catch (error) {
res.status(500).send({ error: error.message });
}
});

router.post('/ban', async (req: Request, res: Response) => {
const userId = req.body.userId;
const banReason = req.body.reason;
const banDuration = req.body.duration;

try {
await banService.applyBan(userId, banReason, banDuration);
res.status(200).send({ message: 'User has been banned successfully.' });
} catch (error) {
res.status(500).send({ error: error.message });
}
});

export default router;
