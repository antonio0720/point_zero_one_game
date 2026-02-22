import { TestBed } from '@angular/core/testing';
import { SpectatorTheater12Component } from './spectator-theater-12.component';
import { SpectatorTheater12Module } from './spectator-theater-12.module';
import { StoreModule } from '@ngrx/store';
import * as fromRoot from '../reducers';
import { provideMockActions } from '@ngrx/effects/testing';
import { SpectatorTheater12Effects } from './spectator-theater-12.effects';
import { of, cold } from 'jasmine-marbles';
import { createInitialState } from '../state';

describe('SpectatorTheater12Component', () => {
let component: SpectatorTheater12Component;
const initialState = createInitialState();

beforeEach(() => {
TestBed.configureTestingModule({
imports: [
SpectatorTheater12Module,
StoreModule.forRoot(fromRoot.reducers, { initialState })
],
providers: [provideMockActions(() => [])],
});

component = TestBed.createComponent(SpectatorTheater12Component);
});

it('should create', () => {
expect(component).toBeTruthy();
});

describe('ngOnInit', () => {
it('should load data on initialization', () => {
const actions$ = of(mockLoadData());
const effectsSpy = spyOn(SpectatorTheater12Effects, 'loadData');

component.ngOnInit();

expect(effectsSpy).toHaveBeenCalledOnceWith(actions$);
});
});

describe('mockLoadData', () => {
it('should return a loadData action with expected payload', () => {
const mockPayload = { data: 'mock-data' };
const action = mockLoadData(mockPayload);

expect(action).toEqual({ type: '[SpectatorTheater12] Load Data Success', payload: mockPayload });
});
});

function mockLoadData() {
return cold('a', { a: { type: '[SpectatorTheater12] Load Data' } });
}
});
