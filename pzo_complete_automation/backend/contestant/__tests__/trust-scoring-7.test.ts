import { createContestant } from '../../../src/contestant';
import { TrustScoringService } from '../../../src/services/trust-scoring';
import { TrustScoreEvent } from '../../../src/models/event';
import { IContestant } from '../../../src/interfaces/contestant';
import { IEvent } from '../../../src/interfaces/event';

describe('Trust Scoring (v7)', () => {
let contestant: IContestant;
let trustScoringService: TrustScoringService;

beforeEach(() => {
trustScoringService = new TrustScoringService();
contestant = createContestant();
});

it('should calculate trust score correctly for first interaction', () => {
const event: IEvent = {
type: 'message',
content: 'Hello, how can I assist you today?',
createdAt: new Date(),
senderId: contestant.id,
recipientId: 'bot',
};

trustScoringService.processEvent(event);

expect(contestant.trustScore).toEqual(75);
});

it('should calculate trust score correctly for positive interaction', () => {
const event1: IEvent = {
type: 'message',
content: 'Thank you for your help!',
createdAt: new Date(),
senderId: contestant.id,
recipientId: 'bot',
};

trustScoringService.processEvent(event1);

const event2: IEvent = {
type: 'message',
content: 'You are very helpful!',
createdAt: new Date(),
senderId: contestant.id,
recipientId: 'bot',
};

trustScoringService.processEvent(event2);

expect(contestant.trustScore).toEqual(80);
});

it('should calculate trust score correctly for negative interaction', () => {
const event1: IEvent = {
type: 'message',
content: 'I don't like your assistance.',
createdAt: new Date(),
senderId: contestant.id,
recipientId: 'bot',
};

trustScoringService.processEvent(event1);

const event2: IEvent = {
type: 'message',
content: 'Your help was not what I expected.',
createdAt: new Date(),
senderId: contestant.id,
recipientId: 'bot',
};

trustScoringService.processEvent(event2);

expect(contestant.trustScore).toEqual(60);
});

it('should calculate trust score correctly for mixed interactions', () => {
const event1: IEvent = {
type: 'message',
content: 'Thank you for your help!',
createdAt: new Date(),
senderId: contestant.id,
recipientId: 'bot',
};

trustScoringService.processEvent(event1);

const event2: IEvent = {
type: 'message',
content: 'I don't like your assistance.',
createdAt: new Date(),
senderId: contestant.id,
recipientId: 'bot',
};

trustScoringService.processEvent(event2);

const event3: IEvent = {
type: 'message',
content: 'You are very helpful!',
createdAt: new Date(),
senderId: contestant.id,
recipientId: 'bot',
};

trustScoringService.processEvent(event3);

expect(contestant.trustScore).toEqual(70);
});
});
