// environment-promotion-1.ts
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as exec from '@actions/exec';

const token = core.getInput('token');
const environmentName = core.getInput('environmentName');
const repositoryOwner = github.context.repo.owner;
const repositoryName = github.context.repo.repo;

async function run() {
const octokit = new github.GitHub(token);

try {
const response = await octokit.rest.repos.getContent({
owner: repositoryOwner,
repo: repositoryName,
path: '.env',
});

if (response.data.content) {
const envContent = Buffer.from(response.data.content, 'base64').toString('ascii');
const environmentVariables = parseEnvFile(envContent);

await octokit.rest.issues.createComment({
owner: repositoryOwner,
repo: repositoryName,
issue_number: github.context.issue.number,
body: `Promoting environment ${environmentName}:\n${JSON.stringify(environmentVariables, null, 2)}`,
});
} else {
core.warning('No .env file found in repository.');
}
} catch (error) {
core.error(error);
}
}

function parseEnvFile(content: string): Record<string, string> {
const envVariables: Record<string, string> = {};

content.split('\n').forEach((line) => {
if (line === '') return;

const [key, value] = line.split('=');
envVariables[key.trim()] = value.trim();
});

return envVariables;
}

run();
