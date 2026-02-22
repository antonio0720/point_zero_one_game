import { Client } from '@elastic/elasticsearch';
import { SettlementData } from '../../interfaces/settlement-data.interface';

const client = new Client({ node: 'http://localhost:9200' }); // Change this to your Elasticsearch instance URL

async function finalizeSettlement(settlementData: SettlementData) {
try {
const { body } = await client.index({
index: 'settlements',
id: settlementData.id,
body: settlementData,
});

console.log(`Settlement finalized successfully: ${body._id}`);
} catch (error) {
console.error(`Error while finalizing settlement: ${error}`);
}
}

export default async function handler(req, res) {
if (req.method !== 'POST') {
return res.status(405).json({ message: 'Method not allowed' });
}

const settlementData: SettlementData = req.body;

await finalizeSettlement(settlementData);

res.status(204).end();
}
