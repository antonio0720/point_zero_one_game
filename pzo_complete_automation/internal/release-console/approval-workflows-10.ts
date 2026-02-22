import { ApprovalWorkflow, WorkflowSteps, WorkflowAction } from 'approval-workflow';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ReleaseData {
version: string;
description: string;
}

const releaseWorkflow = new ApprovalWorkflow({
name: 'Release Workflow',
steps: WorkflowSteps.sequence([
{
name: 'Pre-release checks',
actions: [
{
action: async () => {
// Perform pre-release checks here, e.g., version validity, no open issues, etc.
// If the checks pass, return true; otherwise, throw an error.
return true;
},
},
],
},
{
name: 'Release',
actions: [
{
action: () => {
const releaseCommand = `npm run release ${JSON.stringify(releaseData)}`;
child_process.execSync(releaseCommand);
},
},
],
},
]),
});

const rollbackWorkflow = new ApprovalWorkflow({
name: 'Rollback Workflow',
steps: WorkflowSteps.sequence([
{
name: 'Pre-rollback checks',
actions: [
{
action: async () => {
// Perform pre-rollback checks here, e.g., version consistency, etc.
// If the checks pass, return true; otherwise, throw an error.
return true;
},
},
],
},
{
name: 'Rollback',
actions: [
{
action: () => {
const rollbackCommand = `npm run rollback`;
child_process.execSync(rollbackCommand);
},
},
],
},
]),
});

// Initialize the release data with default values or read from a configuration file.
const releaseData: ReleaseData = {
version: '1.0.0',
description: '',
};

async function runRelease() {
await releaseWorkflow.run();
}

async function runRollback() {
await rollbackWorkflow.run();
}
