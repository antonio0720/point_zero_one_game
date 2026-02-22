interface Threat {
id: string;
name: string;
description: string;
}

const apiEndpointThreats: Threat[] = [
// Spoofing
{
id: 'S-01',
name: 'Identity Spoofing',
description: 'An attacker impersonates a valid user or system to gain unauthorized access.'
},
{
id: 'S-02',
name: 'IP Spoofing',
description: 'An attacker masks their IP address to appear as a trusted source.'
},

// Tampering
{
id: 'T-01',
name: 'Data Modification',
description: 'An attacker alters data transmitted, stored or retrieved by the API.'
},
{
id: 'T-02',
name: 'Input Validation Bypass',
description: 'An attacker bypasses input validation to manipulate API behavior.'
},

// Repudiation
{
id: 'R-01',
name: 'Non-Repudiation of Actions',
description: 'An attacker denies performing certain actions that can be traced back to them.'
},

// Information Disclosure
{
id: 'I-01',
name: 'Unintended Data Leakage',
description: 'Sensitive data is exposed due to lack of proper access controls or encryption.'
},
{
id: 'I-02',
name: 'Insecure Direct Object References (IDOR)',
description: 'An attacker gains unauthorized access to resources by manipulating identifiers directly.'
},

// Denial of Service
{
id: 'D-01',
name: 'Brute Force Attacks',
description: 'An attacker overloads the API with excessive requests to disrupt its service.'
},
{
id: 'D-02',
name: 'Amplification Attack',
description: 'An attacker exploits vulnerabilities in a third-party service to flood the API with traffic.'
},

// Elevation of Privilege
{
id: 'E-01',
name: 'Privilege Escalation',
description: 'An attacker gains higher levels of access than intended through vulnerabilities.'
},
{
id: 'E-02',
name: 'Account Hijacking',
description: 'An attacker obtains another user's account credentials to gain elevated privileges.'
}
];
