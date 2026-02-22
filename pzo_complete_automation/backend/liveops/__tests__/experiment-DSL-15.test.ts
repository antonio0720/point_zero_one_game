import { ExperimentService } from '../../services/experiment.service';
import { Experiment, Rule, Variation } from '../../models';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { MockProvider, provideMockActions } from '@ngrx/effects/testing';
import { ExperimentEffects } from './experiment.effects';

describe('Experiment Effects', () => {
let actions$;
let effects: ExperimentEffects;
let experimentService: Partial<ExperimentService>;

beforeEach(() => {
TestBed.configureTestingModule({
providers: [
MockProvider(ExperimentService),
provideMockActions(() => actions$),
ExperimentEffects,
],
});

effects = TestBed.inject(ExperimentEffects);
actions$ = of();
experimentService = {
createExperiment: jest.fn(),
updateExperiment: jest.fn(),
// Add other methods as needed
};
});

it('should handle CreateExperiment', () => {
const mockExperiment: Experiment = {};
experimentService.createExperiment.mockReturnValue(of(mockExperiment));

actions$ = of(
// Add the action here
);

effects.createExperiment$.subscribe(res => expect(res).toEqual(mockExperiment));
});

it('should handle UpdateExperiment', () => {
const mockExperiment: Experiment = {};
experimentService.updateExperiment.mockReturnValue(of(mockExperiment));

actions$ = of(
// Add the action here
);

effects.updateExperiment$.subscribe(res => expect(res).toEqual(mockExperiment));
});
});
