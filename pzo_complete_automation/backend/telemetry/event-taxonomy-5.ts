if (UserInteractionEvent[eventName as keyof typeof UserInteractionEvent]) {
event = new TelemetryEvent(eventName, EventCategory.USER_INTERACTION);
} else {
throw new Error(`Invalid user interaction event name: ${eventName}`);
}
break;
case EventCategory.SYSTEM_STATE:
if (SystemStateEvent[eventName as keyof typeof SystemStateEvent]) {
event = new TelemetryEvent(eventName, EventCategory.SYSTEM_STATE);
} else {
throw new Error(`Invalid system state event name: ${eventName}`);
}
break;
case EventCategory.ERROR:
if (ErrorEvent[eventName as keyof typeof ErrorEvent]) {
event = new TelemetryEvent(eventName, EventCategory.ERROR);
} else {
throw new Error(`Invalid error event name: ${eventName}`);
}
break;
default:
throw new Error('Invalid event category');
}

return event;
}
}
```

This code defines different event categories and events within each category. It also includes a factory to create `TelemetryEvent` instances based on the provided event name and category. The `TelemetryEvent` class is assumed to be defined elsewhere in your project.
