import fs from 'fs';
import path from 'path';
import minimatch from 'minimatch';

type LogEntry = {
timestamp: Date;
processId?: number;
user?: string;
event: string;
};

function parseLog(filePath: string): LogEntry[] {
const logs: LogEntry[] = [];

let currentLine: string[] = [];

fs.readFileSync(filePath, 'utf8')
.split('\n')
.forEach((line) => {
if (line === '') return;

currentLine = line.trim().split(' ');

// Add the log entry if it has a valid format (timestamp and event)
if (currentLine.length >= 2) {
logs.push({
timestamp: new Date(currentLine[0]),
event: currentLine[1],
});
}
});

return logs;
}

function searchLogs(pattern: string, logFiles: string[]): LogEntry[] {
const matches: LogEntry[] = [];

logFiles.forEach((file) => {
const parsedLogs = parseLog(file);

parsedLogs.forEach((log) => {
if (minimatch(log.event, pattern)) {
matches.push(log);
}
});
});

return matches;
}

function checkUnusualActivity(logs: LogEntry[]): void {
const eventPatterns = [
// Add patterns for events that you consider unusual or suspicious
'sudo',
'su',
'rsync',
'scp',
'wget',
'curl',
'git clone',
];

const matchingLogs = searchLogs(eventPatterns.join('|'), [
// Add paths to log files that you want to monitor
path.join(__dirname, '/var/log/syslog'),
path.join(__dirname, '/var/log/auth.log'),
]);

if (matchingLogs.length > 0) {
console.log('Unusual activity detected:');
matchingLogs.forEach((log) => {
console.log(`- Event: ${log.event}
- Timestamp: ${log.timestamp.toLocaleString()}`);
});
} else {
console.log('No unusual activity found.');
}
}

checkUnusualActivity();
