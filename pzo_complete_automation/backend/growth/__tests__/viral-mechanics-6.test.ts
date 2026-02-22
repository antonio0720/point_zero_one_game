import { Test, TestingModule } from '@nestjs/testing';
import { ViralMechanics6Service } from './viral-mechanics-6.service';
import { ViralMechanics6Controller } from './viral-mechanics-6.controller';

describe('ViralMechanics6Controller', () => {
let controller: ViralMechanics6Controller;
let service: ViralMechanics6Service;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [ViralMechanics6Controller],
providers: [ViralMechanics6Service],
}).compile();

controller = module.get<ViralMechanics6Controller>(ViralMechanics6Controller);
service = module.get<ViralMechanics6Service>(ViralMechanics6Service);
});

it('should be defined', () => {
expect(controller).toBeDefined();
});

describe('processUserData', () => {
it('should return correct result for example 1', () => {
// arrange
const input = [4, 3];

// act
const output = controller.processUserData(input);

// assert
expect(output).toEqual([6]);
});

it('should return correct result for example 2', () => {
// arrange
const input = [10, 4];

// act
const output = controller.processUserData(input);

// assert
expect(output).toEqual([8]);
});

it('should return correct result for example 3', () => {
// arrange
const input = [3, 8];

// act
const output = controller.processUserData(input);

// assert
expect(output).toEqual([1]);
});

it('should return correct result for example 4', () => {
// arrange
const input = [3, 8, 9];

// act
const output = controller.processUserData(input);

// assert
expect(output).toEqual([2]);
});
});
});
