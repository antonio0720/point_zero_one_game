interface Asset {
name: string;
value: number;
}

interface Threat {
id: string;
asset: Asset;
threatType: 'S' | 'T' | 'R' | 'I' | 'D' | 'E';
description: string;
impact: number;
likelihood: number;
}

const assets: Asset[] = [
{ name: 'User Data', value: 10000 },
{ name: 'Server', value: 50000 },
// Add more assets as needed
];

const threats: Threat[] = [
{
id: '1',
asset: assets[0],
threatType: 'I',
description: 'Unauthorized access to user data',
impact: 5,
likelihood: 3,
},
// Add more threats as needed
];

function calculateRisk(threat: Threat): number {
return threat.impact * threat.likelihood;
}

function sortThreatsByRisk(threats: Threat[]): Threat[] {
return threats.sort((a, b) => calculateRisk(b) - calculateRisk(a));
}

const sortedThreats = sortThreatsByRisk(threats);
console.log('Top threats by risk:', sortedThreats.slice(0, 5));
