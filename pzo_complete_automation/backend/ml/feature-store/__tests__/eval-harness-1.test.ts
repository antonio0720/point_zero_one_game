import { TestBed } from '@angular/core/testing';
import { provideMockActions, MockAction } from '@ngrx/effects/test-helpers';
import { Observable, of } from 'rxjs';
import { FeatureEvaluationEffect } from './feature-evaluation.effects';
import { FeatureEvaluationActions, loadFeatureEvaluations, loadFeatureEvaluationsSuccess } from './feature-evaluation.actions';
import { FeatureStoreService } from '../../services/feature-store.service';
import { FeatureEvaluation } from '../models/feature-evaluation.model';

describe('FeatureEvaluationEffect', () => {
let actions$: Observable<MockAction>;
let effects: FeatureEvaluationEffect;
let featureStoreService: jasmine.SpyObj<FeatureStoreService>;

beforeEach(() => {
TestBed.configureTestingModule({});

actions$ = provideMockActions();
featureStoreService = jasmine.createSpyObj('FeatureStoreService', ['loadFeatureEvaluations']);

effects = new FeatureEvaluationEffect(featureStoreService);
});

it('should handle loadFeatureEvaluations', () => {
const mockEvaluations: FeatureEvaluation[] = [
{ id: '1', featureId: 'test-feature', value: 0.5 },
{ id: '2', featureId: 'another-feature', value: 0.7 }
];

const loadFeatureEvaluationsAction = new loadFeatureEvaluations();

featureStoreService.loadFeatureEvaluations.and.returnValue(of(mockEvaluations));

effects.$(() => actions$.behaviorSubject).subscribe((action) => {
expect(action).toEqual(new loadFeatureEvaluationsSuccess({ evaluations: mockEvaluations }));
});

actions$.next(loadFeatureEvaluationsAction);
});
});
