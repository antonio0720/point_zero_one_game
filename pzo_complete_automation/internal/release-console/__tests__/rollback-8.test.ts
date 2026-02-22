import { createMockContext, MockContext } from '@jest/mock';
import { Release, RollbackResponse } from 'aws-sdk/clients/codedeploy';
import rollback from './rollback';

jest.mock('aws-sdk');

describe('rollback', () => {
let mockedAws: Partial<Record<string, jest.Mock>>;
let context: MockContext;

beforeEach(() => {
mockedAws = {
CodeDeploy: {
send: jest.fn().mockResolvedValue({
Promise: jest.fn().mockResolvedValue({
DeploymentId: 'test-deployment-id',
}),
} as any),
},
};
Object.defineProperty(window, 'process', { value: { env: { DEPLOYMENT_ID: 'test-deployment-id' } } });

context = createMockContext({
awsRequestId: 'test-aws-request-id',
logGroupName: 'log-group-name',
logStreamName: 'log-stream-name',
invokeId: 'test-invoke-id',
});
});

it('should call AWS CodeDeploy with correct parameters and return rollback response', async () => {
const deployment = {} as Release;

mockedAws.CodeDeploy.send.mockResolvedValueOnce({
Promise: jest.fn().mockResolvedValue({
DeploymentId: 'test-deployment-id',
RollbackResult: {
DeploymentStatus: 'RollbackStarted',
},
}),
});

const rollbackResponse = await rollback(deployment, context as any);

expect(mockedAws.CodeDeploy.send).toHaveBeenCalledWith(
expect.objectContaining({
action: 'Rollback',
deploymentId: 'test-deployment-id',
region: 'us-west-2', // assuming it's hardcoded in the code or set by environment variable
}),
);

expect(rollbackResponse).toEqual({ DeploymentId: 'test-deployment-id', RollbackStatus: 'RollbackStarted' });
});

it('should handle AWS CodeDeploy errors', async () => {
mockedAws.CodeDeploy.send.mockRejectedValue(new Error('Test error'));

await expect(rollback({} as Release, context as any)).rejects.toThrow('Test error');
});
});
