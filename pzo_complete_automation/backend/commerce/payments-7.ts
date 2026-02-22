import express from 'express';
import stripe from 'stripe';

const app = express();
const stripePromise = stripe(process.env.STRIPE_SECRET_KEY);

app.post('/payments', async (req, res) => {
const amount = req.body.amount;
const currency = 'usd';
const customerId = req.body.customerId;

try {
const stripeCustomer = await stripePromise.customers.retrieve(customerId);
const charge = await stripePromise.charges.create({
amount,
currency,
customer: stripeCustomer.id,
});

res.json({ status: 'success', charge });
} catch (error) {
console.error(error);
res.status(500).json({ status: 'error', error });
}
});

app.listen(3000, () => console.log('Server started on port 3000'));
