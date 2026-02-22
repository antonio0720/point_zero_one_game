import { LogstashClient } from 'aws-sdk';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';

const logstash = new LogstashClient({
region: 'us-west-2', // Change this to your desired region
accessKeyId: process.env.AWS_ACCESS_KEY_ID,
secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const elasticsearch = new AWS.ES({
region: 'us-west-2', // Change this to your desired region
accessKeyId: process.env.AWS_ACCESS_KEY_ID,
secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const logstashInput = 'udp://your-logstash-input-ip:514'; // Update this with your Logstash input IP and port
const indexName = 'your-index-name'; // Update this with your desired Elasticsearch index name
const docType = '_doc';

function sendToElasticsearch(data) {
const params = {
Index: `${indexName}.${docType}`,
Body: data,
};

elasticsearch.index(params, function(err, data) {
if (err) console.error('Error sending log to Elasticsearch: ', err);
});
}

logstash.listen(logstashInput, (err) => {
if (err) {
console.error(`Logstash listening error: ${err}`);
return;
}

console.log('Logstash is listening on', logstashInput);

logstash.on('message', (msg) => {
sendToElasticsearch(JSON.stringify(msg));
});
});
