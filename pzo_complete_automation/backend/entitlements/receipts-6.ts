import * as fs from 'fs';
import * as path from 'path';
import * as jose from 'jose';
import { getPublicKey } from './keys';

interface Receipt {
receiptType: string;
environment: string;
version: number;
purchasingVersion: number;
transactionId?: string;
originalTransactionId?: string;
productIds?: string[];
quantity?: number;
transactionDateMSecsSince1970?: number;
signatureVersion?: number;
signature?: string;
}

const verifyReceipt = async (rawData: string): Promise<Receipt | null> => {
const data = JSON.parse(rawData);

if (!data.receiptType || !data.environment || !data.version) {
return null;
}

const publicKey = await getPublicKey();
if (!publicKey) {
return null;
}

try {
jose.JWKRS256(publicKey).verify(rawData, data.signature);
} catch (error) {
console.error('Invalid receipt signature:', error);
return null;
}

return data as Receipt;
};

const readReceipt = (filePath: string): string | null => {
try {
const fileContent = fs.readFileSync(filePath, 'utf8');
return fileContent;
} catch (error) {
console.error('Error reading receipt file:', error);
return null;
}
};

const loadReceipt = (filePath: string): Receipt | null => {
const rawData = readReceipt(filePath);
if (!rawData) {
return null;
}

return verifyReceipt(rawData);
};

export { loadReceipt };
