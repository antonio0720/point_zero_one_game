import { Sink, Source } from './interfaces';
import { PriorityQueue } from './priority-queue';

export class EconomyEngine {
private sinks: Map<string, Sink>;
private sources: Map<string, Source>;
private connectionCapacity: Map<string, number>;
private priorityQueue: PriorityQueue;

constructor(sinks: Map<string, Sink>, sources: Map<string, Source>, connectionCapacity: Map<string, number>) {
this.sinks = sinks;
this.sources = sources;
this.connectionCapacity = connectionCapacity;
this.priorityQueue = new PriorityQueue();
}

public balance() {
const initialSinkValues = this.getInitialSinkValues();

for (const [sourceId, source] of this.sources) {
this.calculateSourceValue(initialSinkValues, source);
this.priorityQueue.enqueue(sourceId, source.value);
}

while (!this.priorityQueue.isEmpty()) {
const currentSinkId = this.priorityQueue.dequeue().key;
const currentSink = this.sinks.get(currentSinkId)!;

if (currentSink.capacity > 0) {
const connectionId = this.findBestConnection();
const connection = this.sources.get(connectionId)!;

if (connection.value > 0 && currentSink.capacity >= connection.flow) {
currentSink.capacity -= connection.flow;
connection.value -= connection.flow;
currentSink.value += connection.flow;

this.priorityQueue.update(sourceId => sourceId === connectionId ? connection.value : sourceId, connection.value);
}
}
}
}

private getInitialSinkValues() {
const initialSinkValues: { [key: string]: number } = {};

for (const sink of this.sinks.values()) {
initialSinkValues[sink.id] = sink.capacity;
}

return initialSinkValues;
}

private calculateSourceValue(initialSinkValues: { [key: string]: number }, source: Source) {
let totalFlow = 0;

for (const [sinkId, capacity] of Object.entries(initialSinkValues)) {
const connection = this.connectionCapacity.get(`${source.id}-${sinkId}`);

if (connection && capacity > 0) {
totalFlow += Math.min(capacity, source.flow);
}
}

source.value = totalFlow;
}

private findBestConnection() {
let bestConnectionId: string | undefined;
let maxValue: number | undefined;

for (const [connectionId, connection] of this.priorityQueue.items) {
if (connection.value > maxValue && connection.value > 0) {
maxValue = connection.value;
bestConnectionId = connectionId;
}
}

return bestConnectionId!;
}
}
