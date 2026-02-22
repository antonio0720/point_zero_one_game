import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createTestingApp } from './test-utils';
import { ApprovalWorkflow12Service } from '../src/services/approval-workflow12.service';
import { ApprovalWorkflowEvent, WorkflowStatus } from '../src/interfaces';

describe('Release + rollback console - approval-workflows-12', () => {
let app: INestApplication;
let approvalWorkflow12Service: ApprovalWorkflow12Service;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
approvalWorkflow12Service = moduleFixture.get<ApprovalWorkflow12Service>(ApprovalWorkflow12Service);
await app.init();
});

afterAll(async () => {
await app.close();
});

it('/approve should approve the workflow', async () => {
const workflowId = 'test-workflow-id';
const event: ApprovalWorkflowEvent = {
id: workflowId,
status: WorkflowStatus.PendingApproval,
};

await approvalWorkflow12Service.process(event);

const result = await request(app.getHttpServer())
.get(`/workflows/${workflowId}/status`)
.expect(200);

expect(result.body.status).toEqual('Approved');
});

it('/reject should reject the workflow', async () => {
const workflowId = 'test-workflow-id';
const event: ApprovalWorkflowEvent = {
id: workflowId,
status: WorkflowStatus.PendingApproval,
};

await approvalWorkflow12Service.process(event);

const result = await request(app.getHttpServer())
.post(`/workflows/${workflowId}/reject`)
.expect(200);

expect(result.body.status).toEqual('Rejected');
});

it('/rollback should rollback the workflow', async () => {
const workflowId = 'test-workflow-id';
const event: ApprovalWorkflowEvent = {
id: workflowId,
status: WorkflowStatus.Approved,
};

await approvalWorkflow12Service.process(event);

const result = await request(app.getHttpServer())
.post(`/workflows/${workflowId}/rollback`)
.expect(200);

expect(result.body.status).toEqual('Rolled Back');
});
});
