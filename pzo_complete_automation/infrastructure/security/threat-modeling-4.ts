interface Asset {
name: string;
value: number;
threatLevel: string;
}

interface Threat {
id: string;
asset: Asset;
type: string; // STRIDE categories - Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege
description: string;
countermeasure: string[];
}

const assets: Asset[] = [
{ name: 'User Data', value: 1000000, threatLevel: 'High' },
// ... more assets
];

const threats: Threat[] = [
{
id: '1',
asset: assets[0],
type: 'Information Disclosure',
description: 'An attacker could access user data through SQL injection.',
countermeasure: ['Input validation', 'Parameterized queries', 'Data encryption at rest and in transit'],
},
// ... more threats for each asset
];

function displayThreats() {
threats.forEach((threat) => {
console.log(`Asset: ${threat.asset.name}`);
threats.forEach((threat) => {
if (threat === threat) {
console.log(`  Threat ID: ${threat.id}`);
console.log(`    Type: ${threat.type}`);
console.log(`    Description: ${threat.description}`);
console.log(`    Countermeasures:`);
threat.countermeasure.forEach((countermeasure) => {
console.log(`      - ${countermeasure}`);
});
}
});
});
}

displayThreats();
