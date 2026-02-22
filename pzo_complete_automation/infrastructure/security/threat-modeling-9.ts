interface ThreatModel {
id: string;
name: string;
description: string;
category: string;
impact: string;
likelihood: string;
}

enum ThreatModelCategory {
Asset = "Asset",
Cryptography = "Cryptography",
DataHandling = "Data Handling",
ExternalInterfaces = "External Interfaces",
PhysicalEnvironment = "Physical Environment",
PrivilegeManagement = "Privilege Management",
RemoteCodeExecution = "Remote Code Execution",
SecurityLogging = "Security Logging",
SoftwareDevelopment = "Software Development",
}

enum ImpactLevel {
High = "High",
Medium = "Medium",
Low = "Low",
}

enum LikelihoodLevel {
High = "High",
Medium = "Medium",
Low = "Low",
}

const THREAT_MODEL: ThreatModel[] = [
{
id: 'TM01',
name: 'Unvalidated User Input',
description: `Attacker sends malicious input to the application, bypassing filters or restrictions.`,
category: ThreatModelCategory.ExternalInterfaces,
impact: ImpactLevel.High,
likelihood: LikelihoodLevel.Medium,
},
// Add more threat models as needed...
];
