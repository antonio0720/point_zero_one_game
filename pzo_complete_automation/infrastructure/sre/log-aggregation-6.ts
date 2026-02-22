import * as fluent from '@fluent/fluentd-node';
import * as elasticsearch from 'elasticsearch';

const client = new fluent.Client({
tag: 'my_app',
host: 'localhost',
port: 24224,
});

const esClient = new elasticsearch.Client({
host: 'localhost:9200',
log: 'error',
});

async function sendToElasticsearch(log) {
try {
await esClient.index({
index: '.logs',
body: log,
});
} catch (err) {
console.error(`Error indexing log to Elasticsearch: ${err}`);
}
}

client.on('*', async (data) => {
try {
await sendToElasticsearch(JSON.stringify(data));
} catch (err) {
console.error(`Error sending log to Elasticsearch: ${err}`);
}
});
