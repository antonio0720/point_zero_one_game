import { Client as ElasticClient } from '@elastic/elasticsearch';

const client = new ElasticClient({
node: 'http://your-elasticsearch-url',
});

async function indexLog(index: string, doc: any) {
try {
await client.index({
index,
body: doc,
});
} catch (error) {
console.error('Error indexing log: ', error);
}
}

// Example usage with a simple log object
const log = {
timestamp: new Date().toISOString(),
app: 'my-app',
level: 'info',
message: 'This is an example log message.',
};

indexLog('logstash-my-app-logs', log);
