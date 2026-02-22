import * as path from 'path';
import { readFileSync } from 'fs';
import { Configuration, BuildOptions, ResolvedConfig } from 'yarn-lockfile';
import { execSync } from 'child_process';
import { Project } from '@nrwl/workspace';
import { runBuilder } from '../builders/build-pipelines-3';

jest.setTimeout(60000); // Set timeout to 60 seconds for tests

const project = new Project('your-project');
const lockFile = readFileSync(path.join(process.cwd(), 'yarn.lock'), 'utf8');
const config: Configuration = JSON.parse(lockFile);

describe('Build Pipelines 3', () => {
let options: BuildOptions;

beforeAll(() => {
options = {
cwd: process.cwd(),
workspaceRoot: project.root,
project,
config,
};
});

it('should build the pipelines correctly', () => {
const result = runBuilder(options);

// Add assertions here to check the results of the build process
expect(result).toBeTruthy();
});
});
