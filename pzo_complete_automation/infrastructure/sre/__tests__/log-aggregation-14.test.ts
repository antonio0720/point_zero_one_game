import { expect } from 'chai';
import sinon from 'sinon';
import { logAggregator } from './log-aggregator';

describe('Log Aggregation', () => {
let mockLogs: any[];
let mockAggResult: any;
let mockAggregateFunction: (logs: any[]) => any;

beforeEach(() => {
mockLogs = [
{ level: 'INFO', message: 'First log' },
{ level: 'ERROR', message: 'Second log' },
{ level: 'DEBUG', message: 'Third log' },
];

mockAggResult = {
totalCount: 3,
infoCount: 1,
errorCount: 1,
debugCount: 1,
};

mockAggregateFunction = sinon.spy(() => mockAggResult);
});

it('should correctly aggregate logs', () => {
const aggregatedLogs = logAggregator(mockLogs, mockAggregateFunction);
expect(aggregatedLogs).to.deep.equal(mockAggResult);
expect(mockAggregateFunction.calledOnceWithExactly(mockLogs));
});

it('should handle empty logs', () => {
const emptyLogs = [];
const aggregatedLogs = logAggregator(emptyLogs, mockAggregateFunction);
expect(aggregatedLogs).to.deep.equal({ totalCount: 0 });
});
});
