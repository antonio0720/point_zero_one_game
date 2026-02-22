import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RollbackService } from '../rollback.service';
import { FallbackStrategies8Service } from './fallback-strategies-8.service';
import { FallbackStrategyType, RollbackErrorCodes } from '../../enums/rollback.enum';
import { RollbackError } from '../../interfaces/rollback-error.interface';

describe('FallbackStrategies8Service', () => {
let app: INestApplication;
let rollbackService: RollbackService;
let fallbackStrategies8Service: FallbackStrategies8Service;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
rollbackService = moduleFixture.get<RollbackService>(RollbackService);
fallbackStrategies8Service = moduleFixture.get<FallbackStrategies8Service>(FallbackStrategies8Service);
await app.init();
});

afterAll(async () => {
await app.close();
});

describe('execute', () => {
it('should fallback to strategy 8 when all previous strategies fail', async () => {
jest.spyOn(rollbackService, 'handleRollback').mockRejectedValue({
code: RollbackErrorCodes.ROLLBACK_ERROR,
message: 'Simulated rollback error',
} as RollbackError);

const expectedStrategies = [
FallbackStrategyType.strategy1,
FallbackStrategyType.strategy2,
FallbackStrategyType.strategy3,
FallbackStrategyType.strategy4,
FallbackStrategyType.strategy5,
FallbackStrategyType.strategy6,
FallbackStrategyType.strategy7,
];

const actualStrategies = [];

for (let strategy of expectedStrategies) {
await fallbackStrategies8Service[strategy](async () => {
await rollbackService.handleRollback();
actualStrategies.push(strategy);
});
}

expect(actualStrategies).toEqual(expectedStrategies);
});

it('should fallback to strategy 8 and execute it when all previous strategies are successful', async () => {
jest.spyOn(rollbackService, 'handleRollback').mockResolvedValue();

const expectedStrategies = [
FallbackStrategyType.strategy1,
FallbackStrategyType.strategy2,
FallbackStrategyType.strategy3,
FallbackStrategyType.strategy4,
FallbackStrategyType.strategy5,
FallbackStrategyType.strategy6,
FallbackStrategyType.strategy7,
FallbackStrategyType.strategy8,
];

const actualStrategies = [];

for (let strategy of expectedStrategies) {
await fallbackStrategies8Service[strategy](async () => {
actualStrategies.push(strategy);
});
}

expect(actualStrategies).toEqual(expectedStrategies);
});
});
});
