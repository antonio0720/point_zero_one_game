import * as faker from 'faker';
import { Instance, SnapshotInstantiateResult } from 'aws-sdk/clients/ec2';
import * as AWS from 'aws-sdk/dist/aws-sdk-react-native';
import { execSync } from 'child_process';

const ec2 = new AWS.EC2();
const resourceTypes: string[] = ['instance', 'volume'];
const maxInstances = 10;
const instanceIds: string[] = [];

beforeAll(async () => {
const instances: Instance[] = await ec2
.runInstances({
ImageId: 'ami-xxx',
MinCount: 1,
MaxCount: maxInstances,
InstanceType: 't2.micro',
KeyName: 'your-key-pair',
})
.promise();

instances.forEach((instance) => {
instanceIds.push(instance.InstanceId);
});
});

afterAll(async () => {
instanceIds.forEach((id) => {
execSync(`aws ec2 terminate-instances --instance-ids ${id}`);
});
});

test('Failures injections', async () => {
const randomResourceType = faker.random.arrayElement(resourceTypes);
let randomInstance: Instance;

if (randomResourceType === 'instance') {
randomInstance = await ec2
.describeInstances({ InstanceIds: [faker.random.arrayElement(instanceIds)] })
.promise()
.Instances[0];

execSync(`aws ec2 stop-instances --instance-ids ${randomInstance.InstanceId}`);
} else if (randomResourceType === 'volume') {
const randomVolume = await ec2
.describeVolumes({ Filters: [{ Name: 'attachment.instance-id', Values: instanceIds }] })
.promise()
.Volumes[faker.random.number({ min: 0, max: instanceIds.length - 1 })];

execSync(`aws ec2 detach-volume --volume-id ${randomVolume.VolumeId}`);
}
});
