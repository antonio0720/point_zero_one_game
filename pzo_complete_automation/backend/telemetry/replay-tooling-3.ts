import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TelemetryEvent } from './telemetry-event';

interface ReplayConfig {
inputFile: string;
outputFile?: string;
}

function loadConfig(configFilePath: string): ReplayConfig {
const configData = fs.readFileSync(configFilePath, 'utf8');
return yaml.load(configData) as ReplayConfig;
}

function readTelemetryEventsFromFile(filePath: string): TelemetryEvent[] {
const rawEvents = fs.readFileSync(filePath, 'utf8').split('\n');
return rawEvents.map((eventStr) => TelemetryEvent.fromJsonString(eventStr));
}

function writeTelemetryEventsToFile(events: TelemetryEvent[], outputFilePath?: string) {
if (outputFilePath) {
const outputDir = path.dirname(outputFilePath);
!fs.existsSync(outputDir) && fs.mkdirSync(outputDir);

const outputFileStream = fs.createWriteStream(outputFilePath);
events.forEach((event) => outputFileStream.write(`${event.toJsonString()}\n`));
outputFileStream.end();
}
}

function main() {
const config = loadConfig('config.yaml');
const events = readTelemetryEventsFromFile(config.inputFile);
writeTelemetryEventsToFile(events, config.outputFile);
}

main();
