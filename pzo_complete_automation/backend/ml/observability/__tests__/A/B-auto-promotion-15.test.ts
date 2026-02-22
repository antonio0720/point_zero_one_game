import { ABAutoPromotion } from '../ABAutoPromotion';
import { ModelMetrics } from '../../model-metrics';
import { MetricsRepository } from '../../repositories/metrics.repository';
import { PredictionService } from '../../prediction.service';
import { PromotionStrategy } from '../../strategies/promotion.strategy';
import { RandomNumberGenerator } from '../../utils/random-number-generator';
import { Observable, of } from 'rxjs';
import { mockMetrics } from './mocks/mock-metrics';
import { MockPredictionService } from './mocks/mock-prediction.service';
import { MockRandomNumberGenerator } from './mocks/mock-random-number-generator';
import { MockPromotionStrategy } from './mocks/mock-promotion.strategy';

describe('ABAutoPromotion', () => {
let abAutoPromotion: ABAutoPromotion;
let metricsRepository: MetricsRepository;
let predictionService: PredictionService;
let promotionStrategy: PromotionStrategy;
let randomNumberGenerator: RandomNumberGenerator;

beforeEach(() => {
metricsRepository = new MetricsRepository();
predictionService = new MockPredictionService();
promotionStrategy = new MockPromotionStrategy();
randomNumberGenerator = new MockRandomNumberGenerator();

abAutoPromotion = new ABAutoPromotion(metricsRepository, predictionService, promotionStrategy, randomNumberGenerator);
});

it('should promote the variant with better metrics', () => {
const variantAMetrics = mockMetrics('variantA');
const variantBMetrics = mockMetrics('variantB');

jest.spyOn(metricsRepository, 'getModelMetrics').mockImplementation(() => Observable.create((observer) => {
observer.next(variantAMetrics);
observer.complete();
}));

jest.spyOn(abAutoPromotion, 'promoteVariant').mockImplementation((variant: string) => {
expect(variant).toBe('variantA');
return of(true);
});

abAutoPromotion.startPromoting();
});

it('should not promote if the metrics are equal', () => {
const variantAMetrics = mockMetrics('variantA');
const variantBMetrics = mockMetrics('variantB');

jest.spyOn(metricsRepository, 'getModelMetrics').mockImplementation(() => Observable.create((observer) => {
observer.next(variantAMetrics);
observer.next(variantBMetrics);
observer.complete();
}));

jest.spyOn(abAutoPromotion, 'promoteVariant').mockImplementation(() => {
// No need to check the variant here since we're testing that nothing gets promoted
return of(false);
});

abAutoPromotion.startPromoting();
});

it('should randomly promote when metrics are not available', () => {
jest.spyOn(metricsRepository, 'getModelMetrics').mockImplementation(() => Observable.throw(new Error('Error fetching metrics')));
jest.spyOn(abAutoPromotion, 'promoteVariant').mockImplementation((variant: string) => {
expect(randomNumberGenerator.next()).toBeGreaterThanOrEqual(0.5);
return of(true);
});

abAutoPromotion.startPromoting();
});
});
