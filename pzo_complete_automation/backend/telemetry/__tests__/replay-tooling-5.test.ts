import { TestBed } from '@angular/core/testing';
import { ReplayToolingModule } from '../../replay-tooling.module';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { initialState as telemetryInitialState } from '../../state/telemetry.reducer';
import { TelemetryReplayActions } from '../../actions/telemetry-replay.actions';
import { TelemetryReplayEffects } from '../../+state/effects/telemetry-replay.effects';
import { Store, select } from '@ngrx/store';
import { of as observableOf } from 'rxjs';
import { TelemetryService } from '../../services/telemetry.service';
import { initialState as telemetryServiceInitialState } from '../services/telemetry.service.mock';
import { provideMockAction } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { TelemetryReplayActionsTypes } from '../../actions/telemetry-replay.actions';

describe('TelemetryReplayEffects', () => {
let actions$: Observable<Action>;
let effects: TelemetryReplayEffects;
let store: MockStore<any>;
let telemetryService: TelemetryService;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [ReplayToolingModule],
providers: [
provideMockStore({ initialState: telemetryInitialState }),
TelemetryReplayEffects,
{
provide: TelemetryService,
useValue: jasmine.createSpyObj('TelemetryService', ['replay']),
},
],
});

store = TestBed.inject(Store);
effects = TestBed.inject(TelemetryReplayEffects);
telemetryService = TestBed.inject(TelemetryService);

actions$ = store.observable();
});

it('should load replay on loadTelemetryReplay', () => {
const mockLoadReplayAction = provideMockAction({ type: TelemetryReplayActionsTypes.LoadTelemetryReplay });
telemetryService.replay.and.returnValue(observableOf({}));

effects.loadTelemetryReplay$.subscribe((action) => {
expect(telemetryService.replay).toHaveBeenCalledWith();
});

store.dispatch(mockLoadReplayAction);
});

it('should load telemetry on selectTelemetry', () => {
const mockSelectTelemetryAction = provideMockAction({ type: TelemetryReplayActionsTypes.SelectTelemetry });
telemetryService.replay.and.returnValue(observableOf({}));

effects.selectTelemetry$.subscribe((action) => {
expect(telemetryService.replay).toHaveBeenCalledWith('some-id');
});

store.dispatch(mockSelectTelemetryAction);
});
});
