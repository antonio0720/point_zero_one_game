import * as crypto from 'crypto';
import { createHash } from 'crypto';

interface Event {
name: string;
data: any;
}

class ReplayBuffer {
private events: Event[] = [];
private hash: string | undefined;

public push(event: Event): void {
this.events.push(event);
this.hash = undefined;
}

public getHash(): string | undefined {
if (!this.events.length) return undefined;

const eventData = this.events.map(({ name, data }) => `${name}:${JSON.stringify(data)}`).join('|');
const hash = createHash('sha256').update(eventData).digest('hex');
this.hash = hash;

return hash;
}
}

class Replayable {
private replayBuffer: ReplayBuffer;

constructor() {
this.replayBuffer = new ReplayBuffer();
}

public onEvent(event: Event): void {
this.replayBuffer.push(event);
this.applyEvent(event);
}

private applyEvent(event: Event): void {
// Implement the logic to handle events and perform actions
console.log(`Event ${event.name}:`, event.data);
}

public replay(hash: string): void {
const storedHash = this.replayBuffer.getHash();

if (storedHash !== hash) {
throw new Error('Invalid replay hash');
}

this.replayBuffer.events.forEach((event) => this.applyEvent(event));
}
}

const system = new Replayable();
system.onEvent({ name: 'initialize', data: { some: 'data' } });
system.onEvent({ name: 'update', data: { new: 'data' } });

// Save the replay hash for later usage
console.log('Saved replay hash:', system.replayBuffer.getHash());

// Replay the events at a later time
const replayHash = 'your-stored-hash'; // Replace with the stored hash
system.replay(replayHash);
