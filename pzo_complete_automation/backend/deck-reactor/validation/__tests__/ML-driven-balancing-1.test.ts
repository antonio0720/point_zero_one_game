import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DeckReactorService } from '../../services/deck-reactor.service';
import { MockDeckReactorService } from './mock-deck-reactor.service';
import { Balancing1Component } from './balancing1.component';
import { By } from '@angular/platform-browser';

describe('Balancing1Component', () => {
let component: Balancing1Component;
let fixture: ComponentFixture<Balancing1Component>;
let deckReactorService: DeckReactorService;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [Balancing1Component],
providers: [
{ provide: DeckReactorService, useClass: MockDeckReactorService }
]
}).compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(Balancing1Component);
component = fixture.componentInstance;
deckReactorService = TestBed.inject(DeckReactorService);
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

it('should call DeckReactorService.balanceDeck correctly', () => {
const balanceDeckSpy = spyOn(deckReactorService, 'balanceDeck').and.callThrough();
component.ngAfterViewInit();
expect(balanceDeckSpy).toHaveBeenCalled();
});

it('should display correct card counts after balancing', () => {
const expectedCardCounts = [10, 20, 30]; // replace this with the actual expected counts
spyOn(deckReactorService, 'balanceDeck').and.returnValue(of(expectedCardCounts));

fixture.detectChanges();

const cardCountElements = fixture.debugElement.queryAll(By.css('.card-count'));
expect(cardCountElements[0].nativeElement.textContent).toEqual('10');
expect(cardCountElements[1].nativeElement.textContent).toEqual('20');
expect(cardCountElements[2].nativeElement.textContent).toEqual('30');
});
});
