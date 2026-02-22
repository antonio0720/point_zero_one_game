import { Test, TestingModule } from '@nestjs/testing';
import { ActionFuzzing4Service } from './action-fuzzing-4.service';
import * as fuzzystring from 'fuzzystring';
import { FakeInput1Service, FakeInput2Service } from './mocks';

describe('ActionFuzzing4Service', () => {
let service: ActionFuzzing4Service;
let input1Service: FakeInput1Service;
let input2Service: FakeInput2Service;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ActionFuzzing4Service, FakeInput1Service, FakeInput2Service],
}).compile();

service = module.get<ActionFuzzing4Service>(ActionFuzzing4Service);
input1Service = module.get<FakeInput1Service>(FakeInput1Service);
input2Service = module.get<FakeInput2Service>(FakeInput2Service);
});

it('should generate expected results for action-fuzzing-4', () => {
const inputs: string[] = ['abcdefg', 'hijklmnop', 'qrstuvwxyz'];
inputs.forEach((input) => {
// Arrange
jest.spyOn(input1Service, 'execute').mockResolvedValue('result1');
jest.spyOn(input2Service, 'execute').mockResolvedValue('result2');

// Act & Assert
service.executeActionFuzzing4(input).then((result) => {
expect(result).toBe('expected_output');
});

jest.resetAllMocks();
});
});
});
