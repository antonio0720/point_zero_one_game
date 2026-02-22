class EscrowMilestones {
private projects: Map<string, Project> = new Map();
private nextProjectId: number = 1;

constructor(private escrowService: EscrowService) {}

createProject(projectName: string): Project {
const projectId = this.nextProjectId++;
const project = new Project(projectId, projectName);
this.projects.set(projectId, project);
return project;
}

addMilestone(projectId: number, milestone: Milestone): void {
const project = this.projects.get(projectId);
if (!project) {
throw new Error('Project not found');
}
project.addMilestone(milestone);
}

fundMilestone(projectId: number, milestoneId: number): Promise<void> {
const project = this.projects.get(projectId);
if (!project) {
throw new Error('Project not found');
}
return project.fundMilestone(milestoneId, this.escrowService);
}

releaseFunds(projectId: number): Promise<void> {
const project = this.projects.get(projectId);
if (!project) {
throw new Error('Project not found');
}
return project.releaseFunds();
}
}

class Project {
private id: number;
private name: string;
private milestones: Map<number, Milestone> = new Map();
private totalFunds: number = 0;

constructor(id: number, name: string) {
this.id = id;
this.name = name;
}

addMilestone(milestone: Milestone): void {
this.totalFunds += milestone.amount;
this.milestones.set(milestone.id, milestone);
}

fundMilestone(milestoneId: number, escrowService: EscrowService): Promise<void> {
const milestone = this.milestones.get(milestoneId);
if (!milestone) {
throw new Error('Milestone not found');
}
return escrowService.withdraw(milestone.amount, this.id).then(() => {
this.totalFunds -= milestone.amount;
milestone.funded = true;
});
}

releaseFunds(): Promise<void> {
if (this.totalFunds === 0) {
return Promise.resolve();
}
return this.escrowService.deposit(this.totalFunds, this.id);
}
}

interface Milestone {
id: number;
amount: number;
funded?: boolean;
}

class EscrowService {
deposit(amount: number, projectId: number): Promise<void> {
// Implement the logic for depositing funds into escrow.
throw new Error('Not implemented');
}

withdraw(amount: number, projectId: number): Promise<void> {
// Implement the logic for withdrawing funds from escrow.
throw new Error('Not implemented');
}
}
