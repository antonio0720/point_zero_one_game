import express from 'express';
import bodyParser from 'body-parser';
import { Razorpay } from 'razorpay';

const app = express();
app.use(bodyParser.json());

const KEY_ID = 'your_key_id';
const KEY_SECRET = 'your_secret_key';

const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });

app.post('/payment', async (req, res) => {
try {
const order = await razorpay.orders.create({
amount: req.body.amount * 100, // amount in paise
currency: 'INR'
});

res.json({ status: 'success', data: order });
} catch (error) {
console.log(error);
res.status(500).json({ status: 'error', message: error.message });
}
});

app.listen(3000, () => console.log('Server started on port 3000'));
