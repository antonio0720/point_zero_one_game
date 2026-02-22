import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

let users: { id: string, referrals: string[] }[] = [];

app.post('/users', (req, res) => {
const newUser = { id: uuidv4(), referrals: [] };
users.push(newUser);
res.status(201).send(newUser);
});

app.post('/referrals/:userId/invite', (req, res) => {
const { userId } = req.params;
const { referralCode } = req.body;

const user = users.find(u => u.id === userId);
if (!user) return res.status(404).send({ error: 'User not found' });

if (users.some(u => u.referrals.includes(referralCode))) {
return res.status(400).send({ error: 'Referral code already in use' });
}

user.referrals.push(referralCode);
res.send({ success: true });
});

app.listen(3000, () => console.log('Server running on port 3000'));
