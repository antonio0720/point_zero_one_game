import { seasonScheduler } from '../season-scheduler';
import { Season } from '../../models/season';
import { Event } from '../../models/event';
import { calculateAvailableDates } from '../../utils/date-util';

describe('Season Scheduler', () => {
const testSeason: Season = new Season({
id: 'test-season',
name: 'Test Season',
startDate: new Date('2023-01-01'),
endDate: new Date('2023-12-31'),
});

const testEvents: Event[] = [
{
id: 'event-1',
seasonId: testSeason.id,
name: 'Test Event 1',
startDate: new Date('2023-01-15'),
endDate: new Date('2023-01-16'),
},
{
id: 'event-2',
seasonId: testSeason.id,
name: 'Test Event 2',
startDate: new Date('2023-07-04'),
endDate: new Date('2023-07-05'),
},
];

it('should schedule events correctly', () => {
const availableDates = calculateAvailableDates(testSeason.startDate, testSeason.endDate);
for (const event of testEvents) {
expect(seasonScheduler(testSeason, event, availableDates)).toBeTruthy();
}
});

it('should not schedule events that overlap', () => {
const availableDates = calculateAvailableDates(testSeason.startDate, testSeason.endDate);
const overlappingEvent = {
...testEvents[0],
startDate: new Date('2023-01-14'), // Overlaps with event 1
};
expect(seasonScheduler(testSeason, overlappingEvent, availableDates)).toBeFalsy();
});
});
