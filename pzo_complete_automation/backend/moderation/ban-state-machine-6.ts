this.transitionTo(BanState.PENDING_REVIEW, reason);
break;
default:
throw new Error('Cannot apply abuse report to the current state');
}
}

public liftBan(reason?: string): void {
switch (this.currentState) {
case BanState.PENDING_REVIEW:
this.transitionTo(BanState.LIFTED, reason);
break;
default:
throw new Error('Cannot lift ban from the current state');
}
}

private transitionTo(newState: BanState, reason?: string): void {
this.currentState = newState;
console.log(`Transitioned to ${newState} with reason: ${reason}`);
}
}
```

This code sets up a simple state machine for managing bans and abuse reports. A ban can have several states, such as `ACTIVE`, `PENDING_REVIEW`, or `LIFTED`. The `BanStateMachine` class allows you to apply abuse reports and lift bans, transitioning between the different states accordingly.

You can use this state machine by creating a new instance of `BanStateMachine`, applying abuse reports with `applyAbuseReport()`, and lifting bans with `liftBan()`.
