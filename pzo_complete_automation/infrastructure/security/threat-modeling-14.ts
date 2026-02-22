interface StrideThreat {
identity: string;
type: string;
description: string;
}

interface ThreatModel {
title: string;
assets: string[];
data_flows: DataFlow[];
threats: StrideThreat[];
}

interface DataFlow {
name: string;
sources: string[];
sinks: string[];
data: string;
}

const threatModel: ThreatModel = {
title: 'Simple API Threat Model',
assets: ['User Management System', 'API Endpoints'],
data_flows: [
{
name: 'Authentication Flow',
sources: ['Client (Browser)'],
sinks: ['User Management System'],
data: 'Credentials (username, password)',
},
// Add more data flows as needed
],
threats: [
{ identity: '1', type: 'Spoofing', description: 'Attacker impersonates a legitimate user or system' },
{ identity: '2', type: 'Tampering', description: 'Attacker alters data in transit or at rest' },
// Add more threats as needed
],
};
