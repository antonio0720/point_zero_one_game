import * as AWS from 'aws-sdk';
import { Client } from '@chaos-monkey/chaos-monkey';

const s3 = new AWS.S3({ region: 'us-west-2' });
const chaosMonkey = new Client();

async function run() {
const bucketName = process.env.BUCKET_NAME;
if (!bucketName) {
console.error('Please set the BUCKET_NAME environment variable.');
return;
}

// Chaos Monkey configuration
await chaosMonkey.start({
interval: 1000, // 1 second between failure injections
actions: [
{
type: 'terminate',
percentage: 5, // 5% chance of terminating an instance during a second
},
{
type: 'disable',
percentage: 10, // 10% chance of disabling the network for an instance during a second
},
],
});

// S3 operation loop
let counter = 0;
const keyName = 'test-object';

setInterval(() => {
s3.putObject({ Bucket: bucketName, Key: keyName, Body: new Buffer('test data') }, (err) => {
if (err) {
console.error(err);
} else {
counter++;
console.log(`Successfully put object ${counter}`);
}
});
}, 100);
}

run();
