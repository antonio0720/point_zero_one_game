import * as path from 'path';
import * as fs from 'fs-extra';
import * as Signer from './artifact-signing';
import * as AWS from 'aws-sdk';
import { Artifact } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';

jest.mock('aws-sdk');

const artifactPath = path.join(__dirname, 'artifacts', 'sample-artifact.zip');
const signer = new Signer.ArtifactSigner();

describe('Artifact Signing', () => {
let s3: AWS.S3;
let ddb: AWS.DynamoDB;

beforeAll(() => {
s3 = new AWS.S3({ region: 'us-west-2' });
ddb = new AWS.DynamoDB({ region: 'us-west-2' });
});

const artifact: Artifact = {
SKey: uuidv4(),
Mimetype: 'application/zip',
Size: 1024,
Body: Buffer.from(''),
};

it('should sign an artifact successfully', async () => {
// Given: Prepare mocked S3 and DynamoDB responses
const mockS3PutObjectResponse = {
Promise: jest.fn().mockResolvedValue({ Location: 'https://example-bucket.s3.us-west-2.amazonaws.com/signed-artifact' }),
};
s3.putObject = mockS3PutObjectResponse;

const mockDDBPutItemResponse = {
Promise: jest.fn().mockResolvedValue({}),
};
ddb.putItem = mockDDBPutItemResponse;

// When: Call the artifact signing function
await signer.signArtifact(artifactPath, 'example-bucket', 'region');

// Then: Assert that S3 and DynamoDB were called correctly
expect(s3.putObject).toHaveBeenCalledWith({
Bucket: 'example-bucket',
Key: 'signed-artifact',
Body: fs.readFileSync(artifactPath),
ACL: 'private',
});
expect(ddb.putItem).toHaveBeenCalledWith({
TableName: 'Artifacts',
Item: {
SKey: artifact.SKey,
Mimetype: artifact.Mimetype,
Size: artifact.Size,
SignatureUrl: mockS3PutObjectResponse.Promise.mock.calls[0][0].SignatureUrl,
},
});
});

it('should handle errors when signing an artifact', async () => {
// Given: Prepare mocked S3 and DynamoDB responses with errors
const mockS3PutObjectError = new Error('An error occurred during artifact signing');
mockS3PutObjectResponse.Promise.mockRejectedValue(mockS3PutObjectError);

// When: Call the artifact signing function
await expect(signer.signArtifact(artifactPath, 'example-bucket', 'region')).rejects.toEqual(mockS3PutObjectError);

// Then: Assert that S3 and DynamoDB were not called after the error occurred
expect(s3.putObject).toHaveBeenCalledTimes(1);
expect(ddb.putItem).not.toHaveBeenCalled();
});
});
