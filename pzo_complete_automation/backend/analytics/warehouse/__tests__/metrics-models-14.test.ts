import { MetricsModels14 } from '../metrics-models-14';
import { expect } from 'expect';
import { createMockContext } from '@aws-sdk/types';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoDbClient = new DynamoDBClient({ region: 'us-west-2' });

describe('MetricsModels14', () => {
const mockContext = createMockContext({ awsRequestId: 'requestId' });

beforeEach(() => {
jest.clearAllMocks();
});

it('should save data correctly', async () => {
const metricsModels14 = new MetricsModels14(dynamoDbClient);

await metricsModels14.saveData({ key: 'testKey', value: 123 });

const putItemCommand = dynamoDbClient.send as jest.Mock<PutItemCommand>;
expect(putItemCommand).toHaveBeenCalledWith(
{
TableName: 'yourTableName',
Item: {
key: { S: 'testKey' },
value: { N: '123' },
},
}
);
});

it('should get data correctly', async () => {
const metricsModels14 = new MetricsModels14(dynamoDbClient);

const putItemCommand = dynamoDbClient.send as jest.Mock<PutItemCommand>;
putItemCommand.mockResolvedValue({});

await metricsModels14.saveData({ key: 'testKey', value: 123 });

const data = await metricsModels14.getData('testKey');
expect(data).toEqual({ value: 123 });
});

it('should handle errors when saving data', async () => {
const metricsModels14 = new MetricsModels14(dynamoDbClient);

dynamoDbClient.send.mockImplementationOnce(() => {
throw new Error('An error occurred');
});

await expect(metricsModels14.saveData({ key: 'testKey', value: 123 })).rejects.toThrow('An error occurred');
});
});
