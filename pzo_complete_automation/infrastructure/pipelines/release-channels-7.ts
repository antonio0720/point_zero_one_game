// github.actions.ts

import { actions } from '@nakutempo/github-lib';

export async function releaseChannels(context: actions.Context) {
try {
// Get the current GitHub repository
const repo = context.repo();

// Set up npm credentials to access private packages in the npm registry
await actions.authNpm(context);

// Log in to GitHub API with a personal access token
await actions.loginGitHubApi(context);

// Define release channels as an array of objects, each containing the semver range and the npm package name
const releaseChannels = [
{
semverRange: '^1.0.0',
packageName: '@my-org/my-package',
},
// Add more release channels as needed
];

// Loop through each release channel and create or update the corresponding GitHub release
for (const channel of releaseChannels) {
const { semverRange, packageName } = channel;

// Get the npm package version within the specified semver range
const latestVersion = await actions.npmLatestVersion(context, packageName);

// If the latest version is not null, create or update a GitHub release with the new version
if (latestVersion) {
await actions.githubCreateOrUpdateRelease({
owner: repo.owner,
repo: repo.repo,
title: `Release ${latestVersion}`,
body: 'Latest stable release',
tagName: latestVersion,
targetCommitish: 'main',
});
}
}
} catch (error) {
console.error(error);
throw error;
}
}
