import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LadderServiceImpl } from '../ladder_service_impl';
import { Ladder, LadderEvent, LadderStatus, PublisherType } from '../../models';
import { createLadder, createLadderEvent, createPublisher } from '../test_utils';

describe('Casual immediate publish vs verified pending publish + windowed batch update', () => {
  let ladderService: LadderServiceImpl;
  let casualPublisher: any;
  let verifiedPublisher: any;

  beforeEach(() => {
    ladderService = new LadderServiceImpl();
    casualPublisher = createPublisher(PublisherType.CASUAL);
    verifiedPublisher = createPublisher(PublisherType.VERIFIED);
  });

  afterEach(() => {
    // Clear any residual ladders or events for the next test
    ladderService.clear();
  });

  it('should publish a casual ladder immediately', () => {
    const ladder = createLadder(10, LadderStatus.PENDING);
    ladderService.subscribe(casualPublisher, ladder);
    ladderService.publishCasual(ladder);

    expect(ladderService.getLadderById(ladder.id)).toEqual(ladder);
  });

  it('should not publish a verified ladder immediately', () => {
    const ladder = createLadder(10, LadderStatus.PENDING);
    ladderService.subscribe(verifiedPublisher, ladder);
    ladderService.publishVerified(ladder);

    expect(ladderService.getLadderById(ladder.id)).toEqual(ladder); // Ladder should still be PENDING
  });

  it('should publish a verified ladder after verification', () => {
    const ladder = createLadder(10, LadderStatus.PENDING);
    const verificationEvent = createLadderEvent(ladder.id, LadderEvent.VERIFIED);

    ladderService.subscribe(verifiedPublisher, ladder);
    ladderService.handleEvent(verificationEvent);

    expect(ladderService.getLadderById(ladder.id)).toEqual({ ...ladder, status: LadderStatus.VERIFIED });
  });

  it('should batch update ladders within a window', () => {
    const ladder1 = createLadder(10, LadderStatus.PENDING);
    const ladder2 = createLadder(20, LadderStatus.PENDING);
    const ladder3 = createLadder(30, LadderStatus.PENDING);

    ladderService.subscribe(casualPublisher, ladder1);
    ladderService.subscribe(casualPublisher, ladder2);
    ladderService.subscribe(casualPublisher, ladder3);

    // Simulate time passing (e.g., by setting a timer or using a mock clock)
    // ...

    ladderService.batchUpdate();

    const updatedLadders = ladderService.getAllLadders().map(l => l.status);
    expect(updatedLadders).toEqual([LadderStatus.PUBLISHED, LadderStatus.PUBLISHED, LadderStatus.PUBLISHED]);
  });
});
