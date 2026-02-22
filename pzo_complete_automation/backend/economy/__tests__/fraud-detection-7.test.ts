import { Test, TestingModule } from '@nestjs/testing';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudDetector7Strategy } from './strategies/fraud-detector-7.strategy';
import { GetTransactionDto } from '../dtos/get-transaction.dto';

describe('FraudDetectionService', () => {
let service: FraudDetectionService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
FraudDetectionService,
{ provide: FraudDetector7Strategy, useClass: FraudDetector7Strategy },
],
}).compile();

service = module.get<FraudDetectionService>(FraudDetectionService);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('analyzeTransaction', () => {
const testData: GetTransactionDto[] = [
// Add your test data here as an array of GetTransactionDto objects
];

testData.forEach((data) => {
it(`should detect fraud for transaction ${JSON.stringify(data)}`, async () => {
// Replace the following line with your actual code to test whether fraud is detected or not based on the provided data
const result = await service.analyzeTransaction(data);
expect(result).toBeTruthy();
});

it(`should not detect fraud for transaction ${JSON.stringify(data)}`, async () => {
// Replace the following line with your actual code to test whether no fraud is detected based on the provided data
const result = await service.analyzeTransaction(data);
expect(result).toBeFalsy();
});
});
});
});
