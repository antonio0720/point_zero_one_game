import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bodyParser from 'body-parser';
import { referralSchema, rewardSchema } from './schemas';
import Referral from './models/Referral';
import Reward from './models/Reward';

const app = express();
app.use(bodyParser.json());

// POST /api/referrals
app.post('/api/referrals', async (req, res) => {
try {
const { error } = referralSchema.validate(req.body);
if (error) return res.status(400).send(error.details[0].message);

const referrerId = req.body.referrer;
const refereeEmail = req.body.refereeEmail;
const referralCode = uuidv4();

await Referral.create({
referrer: referrerId,
refereeEmail,
referralCode,
status: 'pending',
});

res.send({ success: true, message: 'Referral created successfully.' });
} catch (err) {
console.error(err);
res.status(500).send('Internal Server Error');
}
});

// POST /api/rewards
app.post('/api/rewards', async (req, res) => {
try {
const { error } = rewardSchema.validate(req.body);
if (error) return res.status(400).send(error.details[0].message);

const referralCode = req.body.referralCode;
const rewardType = req.body.rewardType;
const rewardValue = req.body.rewardValue;

const referral = await Referral.findOne({ where: { referralCode } });

if (!referral) return res.status(404).send('Referral not found.');

await Reward.create({
referralId: referral.id,
rewardType,
rewardValue,
status: 'pending',
});

const updatedReferral = await Referral.findOneAndUpdate(
{ where: { referralCode } },
{ status: 'approved' }
);

res.send({ success: true, message: 'Reward created successfully.', data: updatedReferral });
} catch (err) {
console.error(err);
res.status(500).send('Internal Server Error');
}
});

// Set up the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
