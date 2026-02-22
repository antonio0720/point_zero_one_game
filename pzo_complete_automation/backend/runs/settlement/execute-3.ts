import axios from 'axios';

interface SettlementData {
id: number;
accountFromId: number;
accountToId: number;
amount: number;
}

async function executeSettlement(settlementData: SettlementData): Promise<void> {
try {
// Mock API calls for simplicity. Replace with real API endpoints in production.
const { data: accountFrom } = await axios.get(`/api/accounts/${settlementData.accountFromId}`);
const { data: accountTo } = await axios.get(`/api/accounts/${settlementData.accountToId}`);

// Check if accounts exist before processing the settlement
if (!accountFrom || !accountTo) {
throw new Error('Account not found');
}

accountFrom.balance -= settlementData.amount;
accountTo.balance += settlementData.amount;

await axios.put(`/api/accounts/${settlementData.accountFromId}`, accountFrom);
await axios.put(`/api/accounts/${settlementData.accountToId}`, accountTo);

console.log(`Settlement executed successfully: ${settlementData.id}`);
} catch (error) {
console.error(`Error executing settlement: ${settlementData.id}. Error message: ${error.message}`);
}
}
