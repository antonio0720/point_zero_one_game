import { Stripe } from 'stripe';
import { Entitlements } from '@stripe/entitlements-node';
import express from 'express';
import bodyParser from 'body-parser';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
apiVersion: '2022-08-01',
});
const entitlements = Entitlements(stripe);
const app = express();
app.use(bodyParser.json());

app.post('/checkout/session', async (req, res) => {
const session = await stripe.checkout.sessions.create({
customer_email: req.body.customerEmail,
payment_method_types: ['card'],
line_items: [
{
price_data: {
currency: 'usd',
product_data: { name: 'In-app Purchase' },
unit_amount: req.body.price * 100,
},
quantity: 1,
},
],
mode: 'payment',
success_url: req.body.successUrl,
cancel_url: req.body.cancelUrl,
});
res.json({ url: session.url });
});

app.post('/entitlements/check', async (req, res) => {
try {
const entitlement = await entitlements.customer.entitlements.list(
req.body.customerId
);
res.json({ entitlement });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'Failed to check entitlements' });
}
});

app.post('/entitlements/grant', async (req, res) => {
try {
const customer = await stripe.customers.retrieve(req.body.customerId);
await entitlements.customer.entitlements.update(customer.id, {
products: [{ id: req.body.productId }],
});
res.json({ success: true });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'Failed to grant entitlements' });
}
});

app.listen(3000, () => console.log('Server is running on port 3000'));
