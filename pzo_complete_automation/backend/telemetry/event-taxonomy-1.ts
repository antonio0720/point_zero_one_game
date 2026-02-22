interface Event {
name: string;
category: string;
metadata?: Record<string, any>;
}

enum EventCategories {
USER = "User",
SYSTEM = "System",
PERFORMANCE = "Performance"
}

const events: ReadonlyArray<Event> = [
{ name: 'UserRegistered', category: EventCategories.USER },
{ name: 'LoginAttempted', category: EventCategories.USER },
{ name: 'SystemError', category: EventCategories.SYSTEM },
{ name: 'APIRequest', category: EventCategories.PERFORMANCE, metadata: { endpoint: '', latency: 0 } },
];

export default events;
