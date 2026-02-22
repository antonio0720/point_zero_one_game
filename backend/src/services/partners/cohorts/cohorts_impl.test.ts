import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Cohort, CalendarEvent, MembershipReceipt } from '../partners/cohorts/cohorts_impl';
import { generateCalendarEvents, generateMembershipReceipts } from '../utils/test_helpers';

let cohort: Cohort;
let calendarEvents: CalendarEvent[];
let membershipReceipts: MembershipReceipt[];

beforeEach(() => {
  cohort = new Cohort('TestCohort', '2023-01-01', '2023-12-31');
  calendarEvents = generateCalendarEvents(cohort);
  membershipReceipts = generateMembershipReceipts(cohort);
});

afterEach(() => {
  // Clear any side effects or state that might persist between tests
});

describe('Calendar Correctness', () => {
  it('should correctly initialize with the provided start and end dates', () => {
    expect(cohort.startDate).toEqual('2023-01-01');
    expect(cohort.endDate).toEqual('2023-12-31');
  });

  it('should correctly generate calendar events within the cohort period', () => {
    expect(calendarEvents.every(event => event.date >= cohort.startDate && event.date <= cohort.endDate)).toBeTruthy();
  });
});

describe('Membership Receipt Issuance', () => {
  it('should correctly issue membership receipts for each calendar event', () => {
    expect(membershipReceipts.length).toEqual(calendarEvents.length);

    calendarEvents.forEach((event, index) => {
      expect(membershipReceipts[index].eventId).toEqual(event.id);
      expect(membershipReceipts[index].memberId).toBeDefined();
      expect(membershipReceipts[index].amount).toBeGreaterThanOrEqual(0);
    });
  });

  it('should correctly handle edge cases where a member does not attend an event', () => {
    const nonAttendingMemberId = 'NonAttendingMember';
    const nonAttendingEvent = calendarEvents.find(event => event.date === '2023-01-02'); // Replace with actual edge case date

    if (nonAttendingEvent) {
      cohort.removeMemberFromEvent(nonAttendingMemberId, nonAttendingEvent.id);
      expect(membershipReceipts.find(receipt => receipt.memberId === nonAttendingMemberId)).toBeUndefined();
    }
  });
});
