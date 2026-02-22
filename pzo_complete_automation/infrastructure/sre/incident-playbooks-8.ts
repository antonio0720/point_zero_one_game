import * as aws from 'aws-sdk';
import * as sns from 'aws-sdk/clients/sns';

const cloudwatch = new aws.CloudWatch({ region: 'us-west-2' });
const snsClient = new sns();

// Define your topic ARN here
const topicArn = 'arn:aws:sns:us-west-2:123456789012:myTopic';

function sendSNSMessage(message: string) {
return new Promise((resolve, reject) => {
snsClient.publish({
TopicArn: topicArn,
Message: message,
Subject: 'Incident Alert',
}, (err, data) => {
if (err) {
console.error(`Error sending SNS message: ${err}`);
reject(err);
} else {
console.log(`Successfully sent SNS message: ${message}`);
resolve();
}
});
});
}

async function checkCloudWatchAlarmState(alarmName: string) {
const params = {
AlarmName: alarmName,
Namespace: 'AWS/EC2',
};

let alarmState;
do {
const data = await cloudwatch.getAlarmHistory(params).promise();
alarmState = data.DataPoints[0].StateValue;
params.StartTime = data.DataPoints[0].Timestamp;
} while (alarmState !== 'ALARM' && alarmState !== 'OK');

return alarmState === 'ALARM';
}

(async () => {
const alarmName = 'MyEC2Alarm';

// Check if the CloudWatch alarm is in ALARM state
const isInAlarmState = await checkCloudWatchAlarmState(alarmName);

// If the alarm is in ALARM state, send an SNS message
if (isInAlarmState) {
await sendSNSMessage('Incident detected: EC2 instance issue');
}
})();
