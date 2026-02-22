import axios from 'axios';
import * as jose from 'jose';
import { Entitlements } from 'apple-receipts';

const APP_ID = 'your-app-id';
const APP_STORE_CONNECT_API_KEY_ID = 'your-key-id';
const APP_STORE_CONNECT_PRIVATE_KEY = 'your-private-key';
const COMMERCE_SERVER_URL = 'https://commerce.apple.com';

const entitlements = new Entitlements({
appId: APP_ID,
privateKey: jose.getKey(APP_STORE_CONNECT_PRIVATE_KEY),
});

async function validateReceipt(receiptData: string): Promise<boolean> {
const receipt = entitlements.fromJson(JSON.parse(receiptData));

if (!receipt || !receipt.status) return false;

const response = await axios.post(`${COMMERCE_SERVER_URL}/receipts/validateReceipt`, {
receipt: receipt.rawJson,
'api-key': APP_STORE_CONNECT_API_KEY_ID,
});

return response.data && response.data.status === 'success';
}
