import { EventTaxonomy } from '../../../src/backend/telemetry';
import { expect } from 'chai';

describe('Event Taxonomy 8', () => {
it('should correctly categorize events', () => {
const event1 = new EventTaxonomy('event_id_1', 'event_category_1', 'event_action_1');
const event2 = new EventTaxonomy('event_id_2', 'event_category_2', 'event_action_2');

expect(event1.getCategory()).to.equal('event_category_1');
expect(event2.getCategory()).to.equal('event_category_2');

expect(EventTaxonomy.isEventValid(event1)).to.be.true;
expect(EventTaxonomy.isEventValid(event2)).to.be.true;
});

it('should throw an error for invalid events', () => {
const eventWithoutId = new EventTaxonomy('', 'invalid_category', 'invalid_action');
const eventWithoutCategory = new EventTaxonomy('invalid_id', '', 'invalid_action');
const eventWithoutAction = new EventTaxonomy('invalid_id', 'invalid_category', '');

expect(() => EventTaxonomy.isEventValid(eventWithoutId)).to.throw('Event must have an id, category and action.');
expect(() => EventTaxonomy.isEventValid(eventWithoutCategory)).to.throw('Event must have an id, category and action.');
expect(() => EventTaxonomy.isEventValid(eventWithoutAction)).to.throw('Event must have an id, category and action.');
});
});
