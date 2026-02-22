import { replayTooling } from './replay-tooling-1';

const telemetryEvents = Observable.create((observer) => {
// Push events to the observer
observer.next({ name: 'event1' });
observer.next({ name: 'event2' });
});

replayTooling.replay(telemetryEvents).subscribe();
