import { TestBed, async } from '@angular/core/testing';
import { StoreModule } from '@ngrx/store';
import { experimentDSL10Reducer } from './experiment-dsl-10.reducer';
import * as actions from './experiment-dsl-10.actions';

describe('Experiment DSL 10', () => {
beforeEach(() => {
TestBed.configureTestingModule({
imports: [
StoreModule.forRoot({ experimentDSL10: experimentDSL10Reducer })
]
});
});

it('should load Experiment DSL 10', async(() => {
const store = TestBed.get(Store);
store.dispatch(new actions.LoadExperimentDSL10());

store.select(state => state.experimentDSL10).subscribe(res => {
expect(res).not.toBeNull();
});
}));

it('should handle Experiment DSL 10 load success', async(() => {
const store = TestBed.get(Store);
const mockExperimentDSL10 = { id: 'mockId' };

store.dispatch(new actions.LoadExperimentDSL10Success({ payload: mockExperimentDSL10 }));

store.select(state => state.experimentDSL10).subscribe(res => {
expect(res).toEqual(mockExperimentDSL10);
});
}));

it('should handle Experiment DSL 10 load failure', async(() => {
const store = TestBed.get(Store);
const errorMessage = 'Mock Error';

store.dispatch(new actions.LoadExperimentDSL10Failure({ payload: errorMessage }));

store.select(state => state.experimentDSL10Error).subscribe(res => {
expect(res).toEqual(errorMessage);
});
}));
});
