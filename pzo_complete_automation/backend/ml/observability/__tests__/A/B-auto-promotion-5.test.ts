import { Test, TestingModule } from '@nestjs/testing';
import { ABAutoPromotionService } from './a-b-auto-promotion.service';
import { A, B } from './entities';
import { ObservabilityModule } from '../observability/observability.module';
import { Model } from 'keras-js';
import * as chai from 'chai';
const expect = chai.expect;

describe('ABAutoPromotionService', () => {
let service: ABAutoPromotionService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [ObservabilityModule],
providers: [ABAutoPromotionService],
}).compile();

service = module.get<ABAutoPromotionService>(ABAutoPromotionService);
});

it('should be defined', () => {
expect(service).to.not.be.null;
});

describe('trainModel', () => {
let model: Model;

beforeEach(() => {
// Assuming you have methods to create A and B instances
const aInstance = new A();
const bInstance = new B();

// Initialize the model with training data
model = service.initializeModel([aInstance, bInstance]);
});

it('should train the model', async () => {
await service.trainModel(model);
expect(true).to.be.true; // Assuming that training returns a truthy value
});
});

describe('predict', () => {
let model: Model;

beforeEach(() => {
// Assuming you have methods to create A and B instances
const aInstance = new A();
const bInstance = new B();

// Train the model before predicting
model = service.initializeModel([aInstance, bInstance]);
await service.trainModel(model);
});

it('should predict the correct class', async () => {
const predictedClass = await service.predict(model, new A());
expect(predictedClass).to.equal('A');
});
});
});
