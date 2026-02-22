import { Test, TestingModule } from '@nestjs/testing';
import { FailureInjectionService } from './failure-injection.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { failureInjection14Provider } from './failure-injection14.provider';

describe('Failure Injection Service', () => {
let service: FailureInjectionService;
let failureInjection14Model: Model;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [FailureInjectionService, failureInjection14Provider],
}).compile();

service = module.get<FailureInjectionService>(FailureInjectionService);
failureInjection14Model = module.get(getModelToken('FailureInjection14'));
});

it('should throw an error on save', async () => {
jest.spyOn(failureInjection14Model, 'save').mockImplementationOnce(() => {
throw new Error('Expected failure');
});

expect(service.processFailureInjections()).rejects.toThrow('Expected failure');
});

it('should handle the error and log it', async () => {
const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

service.processFailureInjections();

expect(logSpy).toHaveBeenCalledWith('Expected failure');
});

afterEach(() => {
jest.restoreAllMocks();
});
});
