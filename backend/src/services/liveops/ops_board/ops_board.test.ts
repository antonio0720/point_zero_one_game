import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Ops Board Rollup Correctness', () => {
  let opsBoard;

  beforeEach(() => {
    opsBoard = new OpsBoard(); // Assuming there's a constructor for OpsBoard
  });

  afterEach(() => {
    // Reset any state or mock data here if necessary
  });

  it('should correctly rollup daily revenue when provided with valid data', () => {
    const dailyRevenueData = [
      { date: '2022-01-01', revenue: 100 },
      { date: '2022-01-02', revenue: 200 },
      { date: '2022-01-03', revenue: 300 }
    ];

    opsBoard.processDailyRevenue(dailyRevenueData);

    const expectedTotal = 600;
    expect(opsBoard.getTotalDailyRevenue()).toEqual(expectedTotal);
  });

  it('should correctly rollup daily revenue when provided with empty data', () => {
    opsBoard.processDailyRevenue([]);

    const expectedTotal = 0;
    expect(opsBoard.getTotalDailyRevenue()).toEqual(expectedTotal);
  });

  it('should correctly rollup daily revenue when provided with missing date or revenue', () => {
    const invalidData = [
      { date: '2022-01-01', revenue: undefined },
      { date: undefined, revenue: 200 },
      { date: '2022-01-03', revenue: null }
    ];

    opsBoard.processDailyRevenue(invalidData);

    const expectedTotal = 0;
    expect(opsBoard.getTotalDailyRevenue()).toEqual(expectedTotal);
  });

  it('should trigger anomaly detection when daily revenue exceeds threshold', () => {
    const highRevenueData = [
      { date: '2022-01-01', revenue: 500 },
      { date: '2022-01-02', revenue: 600 }
    ];

    opsBoard.processDailyRevenue(highRevenueData);

    expect(opsBoard.isAnomalyDetected()).toBeTruthy();
  });

  it('should not trigger anomaly detection when daily revenue is within threshold', () => {
    const normalRevenueData = [
      { date: '2022-01-01', revenue: 150 },
      { date: '2022-01-02', revenue: 200 }
    ];

    opsBoard.processDailyRevenue(normalRevenueData);

    expect(opsBoard.isAnomalyDetected()).toBeFalsy();
  });
});
