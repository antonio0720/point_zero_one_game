import { logAggregator } from '../../src/log-aggregator';
import * as logger from 'winston';
import { getTestLoggerInstance, cleanUpLoggers } from '../utils/logger';
import { LogEntry } from '@myproject/common';

describe('log aggregation', () => {
beforeAll(() => {
const testLogger = getTestLoggerInstance();
logger.add(testLogger);
});

afterAll(() => cleanUpLoggers());

it('should aggregate logs properly', () => {
// Arrange
const logEntry1: LogEntry = { timestamp: new Date(), level: 'info', message: 'Test log 1' };
const logEntry2: LogEntry = { timestamp: new Date(), level: 'warning', message: 'Test log 2' };
const logEntry3: LogEntry = { timestamp: new Date(), level: 'error', message: 'Test log 3' };

// Act
logAggregator([logEntry1, logEntry2, logEntry3]);

// Assert
let aggregatedLogs: string[] = [];
logger.transports.forEach((transport) => {
if (transport.name === 'console') {
transport.on('log', (info) => {
aggregatedLogs.push(info.message);
});
}
});

expect(aggregatedLogs).toEqual([
`[2023-03-16T18:30:00.000Z] [info] Test log 1`,
`[2023-03-16T18:30:00.000Z] [warning] Test log 2`,
`[2023-03-16T18:30:00.000Z] [error] Test log 3`,
]);
});

it('should aggregate logs with multiple messages', () => {
// Arrange
const logEntry1: LogEntry = { timestamp: new Date(), level: 'info', message: ['Test log 1 part 1', 'Test log 1 part 2'] };
const logEntry2: LogEntry = { timestamp: new Date(), level: 'warning', message: ['Test log 2 part 1', 'Test log 2 part 2'] };
const logEntry3: LogEntry = { timestamp: new Date(), level: 'error', message: ['Test log 3 part 1', 'Test log 3 part 2'] };

// Act
logAggregator([logEntry1, logEntry2, logEntry3]);

// Assert
let aggregatedLogs: string[] = [];
logger.transports.forEach((transport) => {
if (transport.name === 'console') {
transport.on('log', (info) => {
aggregatedLogs.push(info.message);
});
}
});

expect(aggregatedLogs).toEqual([
`[2023-03-16T18:30:00.000Z] [info] Test log 1 part 1 Test log 1 part 2`,
`[2023-03-16T18:30:00.000Z] [warning] Test log 2 part 1 Test log 2 part 2`,
`[2023-03-16T18:30:00.000Z] [error] Test log 3 part 1 Test log 3 part 2`,
]);
});
});
