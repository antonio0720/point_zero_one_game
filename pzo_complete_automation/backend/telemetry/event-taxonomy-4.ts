const emitter = new TelemetryEmitter();
emitter.emit({ name: 'PageView', category: 'UserInteraction', properties: { pageUrl: '/example-page' } });
// ... emit more events
emitter.flush();
