import { Event, IEventStore } from "./IEventStore";
import { ISerializer } from "../serialization/ISerializer";
import { Version } from "../common/Version";

export class DeterministicReplay6<T> implements IEventStore<T> {
private events: Event<T>[];
private serializer: ISerializer;
private version = new Version(6);

constructor(serializer: ISerializer) {
this.events = [];
this.serializer = serializer;
}

public append(event: Event<T>) {
const serializedEvent = this.serializer.serialize(event);
this.events.push(serializedEvent);
}

public loadFromCheckpoint(checkpoint: any): void {
this.events = checkpoint;
}

public getCurrentVersion(): Version {
return this.version;
}

public readStream(streamId: string): Event<T>[] {
const eventsInStream = this.events.filter((event) => event.streamId === streamId);
return eventsInStream;
}

public saveCheckpoint(): any {
return this.events;
}
}
