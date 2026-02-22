import { TestBed } from '@angular/core/testing';
import { MisclickGuard5Component } from './misclick-guard-5.component';
import { RouterTestingModule } from '@angular/router/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { initialState, reducer, selectors } from '../../../+state';

describe('MisclickGuard5Component', () => {
let component: MisclickGuard5Component;
let store: MockStore;

beforeEach(() => {
TestBed.configureTestingModule({
imports: [RouterTestingModule],
declarations: [MisclickGuard5Component],
providers: [
provideMockStore({ initialState })
]
});

store = TestBed.inject(MockStore);
component = TestBed.component(MisclickGuard5Component);
});

it('should create', () => {
expect(component).toBeTruthy();
});

describe('when initial state', () => {
beforeEach(() => {
store.overrideSelect(selectors.selectIsCorrectAnswer, false);
});

it('should show next button disabled', () => {
expect(component.nextButtonDisabled).toBeTrue();
});
});

describe('when correct answer state', () => {
beforeEach(() => {
store.overrideSelect(selectors.selectIsCorrectAnswer, true);
});

it('should show next button enabled', () => {
expect(component.nextButtonDisabled).toBeFalse();
});
});
});
