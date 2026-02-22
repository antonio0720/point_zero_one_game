import * as snyk from 'snyk';

async function scanProject(token: string, projectId: string) {
const options = { apiKey: token };
const client = snyk.createClient(options);

try {
const result = await client.testProject({ id: projectId });
console.log('Scan Results:', result);
} catch (error) {
console.error('Error while scanning the project:', error);
}
}

// Replace with your Snyk API token and project ID
scanProject('your_api_token', 'your_project_id');
