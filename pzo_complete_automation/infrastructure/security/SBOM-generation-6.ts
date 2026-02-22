import * as exec from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const generateNpmAuditReport = () => {
return new Promise((resolve, reject) => {
const command = 'npm audit -json --production';
exec.exec(command, (error, stdout, stderr) => {
if (error) {
console.error(`exec error: ${error}`);
reject(error);
}

try {
const jsonData = JSON.parse(stdout);
resolve(jsonData);
} catch (e) {
console.error(`Error parsing output: ${e}`);
reject(e);
}
});
});
};

const generateNexusSBOMReport = (auditReport) => {
// Replace the placeholders with your Nexus credentials and URL
const nexusUrl = 'https://your-nexus-instance';
const username = 'your-username';
const password = 'your-password';

const command = `curl -u ${username}:${password} -X POST -H "Content-Type: application/json" "${nexusUrl}/service/rest/v1/sast-scanner/reports" -d "${JSON.stringify(auditReport)}"`;
exec.execSync(command);
};

generateNpmAuditReport().then((auditReport) => {
generateNexusSBOMReport(auditReport);
}).catch((error) => {
console.error(`Error generating SBOM: ${error}`);
});
