import axios from 'axios';
import * as ShopifyPli from '@shopify/cli-kit';
import { Shopify } from '@shopify/shopify-api-node';

const apiKey = process.env.SHOPIFY_API_KEY;
const password = process.env.SHOPIFY_PASSWORD;
const shopName = process.env.SHOPIFY_DOMAIN;
const accessToken = ShopifyPli.Auth.authenticateAPI({ apiKey, password, scopes: ['read_products', 'write_customers'] }, shopName);

const shopify = new Shopify({ url: `https://${shopName}/admin/api/2022-04`, accessToken });

interface ProductEntitlement {
id: string;
customerAccessId: string;
}

async function createProductEntitlement(productId: number, customerAccessId: string): Promise<ProductEntitlement> {
const entitlement = await shopify.resource(`/admin/api/307152968/graphql.json`).query(`
mutation CreateProductEntitlement($input: CreateEntitlementInput!) {
createEntitlement(input: $input) {
userErrors {
message
}
entitlement {
id
customerAccessId
}
}
}
`, { input: { productIds: [productId.toString()], customerAccessId } }).then(res => res.data.createEntitlement.entitlement);

if (entitlement.userErrors) throw new Error(entitlement.userErrors[0].message);
return entitlement;
}

async function getCustomerById(customerId: string): Promise<any> {
return await shopify.resource(`/admin/api/2022-04/customers/${customerId}.json`).get();
}

async function purchaseProduct(customer: any, productId: number) {
// Simulate a purchase process here, for example with a third-party payment provider.

const entitlement = await createProductEntitlement(productId, customer.id);
console.log(`Created product entitlement ${entitlement.id} for customer ${customer.email}`);
return entitlement;
}

async function main() {
if (!apiKey || !password || !shopName) {
console.error('Missing required environment variables: SHOPIFY_API_KEY, SHOPIFY_PASSWORD, and SHOPIFY_DOMAIN');
process.exit(1);
}

const customer = await getCustomerById('64825013794844'); // Replace with a valid customer ID
if (!customer) {
console.error('Error fetching customer');
return;
}

const productId = 123456789; // Replace with a valid product ID
purchaseProduct(customer, productId);
}

main();
