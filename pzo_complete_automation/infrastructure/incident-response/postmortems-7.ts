class Postmortem {
title: string;
description: string;
timeline: Timeline[];
mitigationActions: MitigationAction[];
learnings: Learning[];

constructor(title: string, description: string) {
this.title = title;
this.description = description;
this.timeline = [];
this.mitigationActions = [];
this.learnings = [];
}

addTimelineEvent(event: TimelineEvent): void {
const timelineEvent = new TimelineEvent(event.time, event.description);
this.timeline.push(timelineEvent);
}

addMitigationAction(action: MitigationAction): void {
this.mitigationActions.push(action);
}

addLearning(learning: Learning): void {
this.learnings.push(learning);
}
}

class TimelineEvent {
time: string;
description: string;

constructor(time: string, description: string) {
this.time = time;
this.description = description;
}
}

interface MitigationAction {
action: string;
responsibleParty: string;
dueDate: string;
}

interface Learning {
issue: string;
proposedSolution: string;
responsibleParty: string;
dueDate: string;
}
