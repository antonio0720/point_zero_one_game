interface Attack {
name: string;
structure: string;
tactic: string;
resources: string[];
impact: string;
dataOrGoal: string;
}

class ThreatModel {
private assets: string[];
private vulnerabilities: string[];
private attacks: Attack[] = [];

constructor(assets: string[], vulnerabilities: string[]) {
this.assets = assets;
this.vulnerabilities = vulnerabilities;
}

addAttack(attack: Attack): void {
this.attacks.push(attack);
}

getThreatModel(): Attack[] {
return this.attacks;
}

threatModelingStraightRide() {
const assetVulnerabilities = this.assets.map((asset) => {
return this.vulnerabilities.filter(
(vulnerability) => vulnerability.includes(asset)
);
});

assetVulnerabilities.forEach((vulnerabilitiesOfAsset) => {
vulnWithPotentialAttacks(vulnerabilitiesOfAsset).forEach((attack) => {
this.addAttack(attack);
});
});
}
}

function vulnWithPotentialAttacks(vulnerabilities: string[]) {
return vulnerabilities.map((vulnerability) => {
const tactic = mapTacticToVulnerability(vulnerability);
const structure = mapStructureToVulnerability(vulnerability);
const resources = getResourcesForTactic(tactic);
const impact = mapImpactFromVulnerability(vulnerability);
const dataOrGoal = getDataOrGoalFromAsset(vulnerability);

return {
name: `Attack ${Math.floor(Math.random() * 1000)}`,
structure,
tactic,
resources,
impact,
dataOrGoal,
};
});
}

function mapTacticToVulnerability(vulnerability: string): string {
// Map vulnerability to a specific tactic (e.g., Reconnaissance, Weakness Exploitation, etc.)
if (vulnerability.includes("unpatched")) return "Weakness Exploitation";
if (vulnerability.includes("weak-passwords")) return "Credential Harvesting";
// Add more mappings as needed

throw new Error(`Unable to find tactic for vulnerability: ${vulnerability}`);
}

function mapStructureToVulnerability(vulnerability: string): string {
// Map vulnerability to a specific structure (e.g., DoS, Exfiltration, etc.)
if (vulnerability.includes("DoS")) return "Denial of Service";
if (vulnerability.includes("Exfiltration")) return "Exfiltration of Data";
// Add more mappings as needed

throw new Error(`Unable to find structure for vulnerability: ${vulnerability}`);
}

function getResourcesForTactic(tactic: string): string[] {
// Define resources needed for each tactic (e.g., scanning tools, brute-force software)
if (tactic === "Weakness Exploitation") return ["exploit kits", "vulnerability scanners"];
if (tactic === "Credential Harvesting") return ["password crackers", "phishing emails"];
// Add more resources as needed

throw new Error(`Unable to find resources for tactic: ${tactic}`);
}

function mapImpactFromVulnerability(vulnerability: string): string {
// Map vulnerability to a specific impact (e.g., Confidentiality, Integrity, Availability)
if (vulnerability.includes("unpatched")) return "Availability";
if (vulnerability.includes("weak-passwords")) return "Confidentiality";
// Add more mappings as needed

throw new Error(`Unable to find impact for vulnerability: ${vulnerability}`);
}

function getDataOrGoalFromAsset(vulnerability: string): string {
// Determine the data or goal being targeted by an attack (e.g., customer data, sensitive files)
if (vulnerability.includes("customer data")) return "Customer Data";
if (vulnerability.includes("sensitive files")) return "Sensitive Files";
// Add more mappings as needed

throw new Error(`Unable to find data or goal for vulnerability: ${vulnerability}`);
}
