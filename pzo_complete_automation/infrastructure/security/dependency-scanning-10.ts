import * as Snyk from 'snyk';

async function scanProject(token: string, orgId?: string) {
const client = new Snyk({ token });

try {
if (orgId) {
await client.organizations.inviteToOrg({ orgId });
}

await client.projects.create();
await client.projects.analyze();

const project = await client.projects.getFirst();
console.log(`Project ID: ${project.id}`);
console.log(`Vulnerabilities found: ${project.vulnerabilityCount}`);
} catch (error) {
console.error('Error during the scan:', error);
}
}

const snykToken = 'your_snyk_token';
scanProject(snykToken, 'your_organization_id');
