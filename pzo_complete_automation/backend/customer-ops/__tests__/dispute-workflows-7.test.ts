import { DisputeWorkflowService } from '../../services/dispute-workflow.service';
import { DisputeWorkflowRepository } from '../../repositories/dispute-workflow.repository';
import { DisputeWorkflowEntity } from '../../entities/dispute-workflow.entity';
import { CreateDisputeWorkflowDto } from '../../dtos/create-dispute-workflow.dto';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('DisputeWorkflowService', () => {
let service: DisputeWorkflowService;
let repository: DisputeWorkflowRepository;

beforeEach(async () => {
const module = await Test.createTestingModule({
providers: [
DisputeWorkflowService,
{ provide: DisputeWorkflowRepository, useValue: new DisputeWorkflowRepository() },
// Add other required services here
],
}).compile();

service = module.get<DisputeWorkflowService>(DisputeWorkflowService);
repository = module.get<DisputeWorkflowRepository>(DisputeWorkflowRepository);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('createDisputeWorkflow', () => {
const createDto: CreateDisputeWorkflowDto = new CreateDisputeWorkflowDto();

beforeEach(() => {
// Set up the createDto as needed for each test case
});

it('should create a dispute workflow', async () => {
// Arrange
const expectedResult: DisputeWorkflowEntity = new DisputeWorkflowEntity();
// ... set up expectedResult as needed

jest.spyOn(repository, 'save').resolves(expectedResult);

// Act
const result = await service.createDisputeWorkflow(createDto);

// Assert
expect(result).toEqual(expectedResult);
expect(repository.save).toHaveBeenCalledTimes(1);
});

it('should handle an error when creating a dispute workflow', async () => {
// Arrange
jest.spyOn(repository, 'save').rejects(new Error('Test Error'));

// Act and Assert
await expect(service.createDisputeWorkflow(createDto)).rejects.toThrow('Test Error');
});
});
});
