class PostmortemManager {
private postmortems: Map<number, Postmortem> = new Map();

createPostmortem(incidentId: number, title: string, description: string): void {
const postmortem = new Postmortem(incidentId, title, description);
this.postmortems.set(incidentId, postmortem);
}

getPostmortem(incidentId: number): Postmortem | undefined {
return this.postmortems.get(incidentId);
}

updatePostmortem(incidentId: number, updates: Partial<Postmortem>): void {
const postmortem = this.getPostmortem(incidentId);

if (postmortem) {
Object.assign(postmortem, updates);
}
}
}

interface Postmortem {
incidentId: number;
title: string;
description: string;
}
