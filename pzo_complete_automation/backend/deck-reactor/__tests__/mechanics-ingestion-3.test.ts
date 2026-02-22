import { MechanicsIngestionService } from '../src/services/mechanics-ingestion.service';
import { Mechanic, Deck } from '../src/interfaces';
import { of } from 'rxjs';

describe('MechanicsIngestionService', () => {
let service: MechanicsIngestionService;

beforeEach(() => {
service = new MechanicsIngestionService();
});

it('should be created', () => {
expect(service).toBeTruthy();
});

describe('ingestMechanic', () => {
it('should add a mechanic to the deck correctly', () => {
const mechanic: Mechanic = { id: 1, name: 'Test Mechanic' };
const deck: Deck = { id: 1, name: 'Test Deck' };
const mechanicAddedToDeck: Mechanic = { ...mechanic, decks: [deck.id] };

jest.spyOn(service, 'getDeckById').mockReturnValue(of(deck));

service.ingestMechanic(mechanic).subscribe((result) => {
expect(result).toEqual(mechanicAddedToDeck);
});
});
});

describe('getDeckById', () => {
it('should return the correct deck by id', () => {
const deckId = 1;
const deck: Deck = { id: deckId, name: 'Test Deck' };
const mockDecks: Deck[] = [deck];

jest.spyOn(service, 'findAllDecks').mockReturnValue(of(mockDecks));

service.getDeckById(deckId).subscribe((result) => {
expect(result).toEqual(deck);
});
});
});
});
