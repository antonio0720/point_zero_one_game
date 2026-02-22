import { Client as ESClient } from 'aws-sdk/clients/elasticsearch';

const es = new ESClient({
region: 'us-west-2',
accessKeyId: process.env.AWS_ACCESS_KEY_ID,
secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

async function indexLogs(index: string, docType: string, logs: any[]) {
for (const log of logs) {
await es.index({
Index: index,
Type: docType,
Body: log,
}).promise();
}
}

// Example usage
async function main() {
const logs = [
{ timestamp: new Date().toISOString(), message: 'Example log 1' },
{ timestamp: new Date().toISOString(), message: 'Example log 2' },
// Add more logs here...
];

await indexLogs('log-index', '_doc', logs);
}

main();
