import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
if (req.method !== 'POST') {
return res.status(405).json({ error: 'Method not allowed' });
}

try {
const receipt = await stripe.checkout.session.retrieve(req.query.session_id as string);

if (!receipt) {
return res.status(404).json({ error: 'Receipt not found' });
}

// Verify the entitlements using receipt.customer, receipt.subscription and receipt.items.data[i].price.id
// ...

res.status(200).json({ success: true });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while processing the receipt' });
}
}
