import { exec } from 'child_process';
import { promises as fs } from 'fs';

interface AuditResult {
severity: string;
vulnerabilityId: string;
packageName: string;
affectedVersion: string;
}

const runAudit = async (): Promise<AuditResult[]> => {
return new Promise((resolve, reject) => {
exec('npm audit', (error, stdout, stderr) => {
if (error) {
console.error(`exec error: ${error}`);
reject(error);
}
const results: AuditResult[] = [];
const lines = stdout.split('\n');
let currentResult: Partial<AuditResult> = {};

lines.forEach((line) => {
if (line.includes('Severity')) {
currentResult = { severity: line.split(':')[1].trim() };
} else if (line.includes('  vulnerability')) {
const [_, id, name, affected] = line.match(/\s+(\w{8})/)[0].split('\t');
currentResult.vulnerabilityId = id;
currentResult.packageName = name;
currentResult.affectedVersion = affected;
} else if (line.includes('Resolved')) {
results.push(currentResult as AuditResult);
currentResult = {};
}
});
resolve(results);
});
});
};

const getVulnerabilities = async () => {
const auditResults = await runAudit();
if (auditResults.length > 0) {
console.log('Found vulnerabilities:');
auditResults.forEach((result) => {
console.log(`- Severity: ${result.severity}`);
console.log(`  - Vulnerability ID: ${result.vulnerabilityId}`);
console.log(`  - Package Name: ${result.packageName}`);
console.log(`  - Affected Version: ${result.affectedVersion}`);
console.log();
});
} else {
console.log('No vulnerabilities found.');
}
};

getVulnerabilities().catch((error) => {
console.error(`Error during dependency scanning: ${error}`);
});
