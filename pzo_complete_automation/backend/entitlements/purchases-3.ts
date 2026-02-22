import { createStripe } from "@stripe/stripe-node";
import { NextApiRequest, NextApiResponse } from "next";

const stripe = createStimeout(createStripe(process.env.STRIPE_SECRET_KEY), 5000);

export default async function handlePurchase(req: NextApiRequest, res: NextApiResponse) {
if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

const { productId, customerId } = req.body;

try {
// Create a Checkout Session for the purchase
const checkoutSession = await stripe.checkout.sessions.create({
line_items: [
{
price_data: {
currency: "usd",
product_data: {
name: `Product ${productId}`,
},
unit_amount: 1000, // 10 USD (Adjust the amount as needed)
},
quantity: 1,
},
],
customer: customerId,
payment_method_types: ["card"],
mode: "payment",
success_url: process.env.STRIPE_SUCCESS_URL,
cancel_url: process.env.STRIPE_CANCEL_URL,
});

// Redirect the customer to the Checkout Session URL
res.redirect(303, checkoutSession.url);
} catch (error) {
console.error(error);
res.status(500).json({ error: "An error occurred while creating the Checkout Session." });
}
}

// Entitlements API calls
export async function createEntitlement(userId: string, entitlementId: string) {
// Call the Entitlements API to associate the user with the product
const customer = await stripe.customers.retrieve(userId);
await stripe.entitlements.create({
customer,
items: [{ id: entitlementId }],
});
}

export async function revokeEntitlement(userId: string, entitlementId: string) {
// Call the Entitlements API to disassociate the user from the product
const customer = await stripe.customers.retrieve(userId);
await stripe.entitlements.del(customer.id, entitlementId);
}
