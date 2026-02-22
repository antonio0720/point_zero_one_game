import { Stripe } from '@stripe/stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
apiVersion: '2020-08-27',
});

export const createSettlement = async (req, res) => {
try {
const { paymentIntentId } = req.body;

if (!paymentIntentId) {
return res.status(400).json({ error: 'Payment intent ID is required.' });
}

const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
if (paymentIntent.status !== 'succeeded') {
return res.status(500).json({ error: 'Payment intent is not succeeded.' });
}

const settlement = await stripe.settlements.create({
payment_intent_data: [{ id: paymentIntentId }],
transfer_data: [{ amount: paymentIntent.amount_received / 100, currency: paymentIntent.currency }],
});

res.status(201).json({ settlement });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while creating the settlement.' });
}
};
