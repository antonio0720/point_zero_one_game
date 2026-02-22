// ts-node/dist/register.js requires this to work in CodePipeline
process.env.NODE_EVENTLOOP = 'worker';

import * as greenkeeper from '@greenkeeperio/greenkeeper-cli';

greenkeeper({
apiKey: process.env.GREENKEEPER_API_KEY, // Replace with your GreenKeeper API key
orgName: process.env.GREENKEEPER_ORGANIZATION, // Replace with your GreenKeeper organization name
repoToken: process.env.GITHUB_TOKEN, // Replace with your GitHub personal access token
githubOwner: 'YOUR_GITHUB_USERNAME', // Replace with your GitHub username
githubRepo: 'YOUR_REPO', // Replace with the name of your repository (e.g., my-repo)
branch: 'main', // Or the branch you want to scan
paths: ['package.json'], // List of files that GreenKeeper should analyze for dependencies
}).then(() => {
console.log('Dependency scanning completed successfully.');
});
