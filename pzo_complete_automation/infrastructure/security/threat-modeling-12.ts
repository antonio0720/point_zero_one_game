interface ThreatModel {
id: string;
name: string;
description: string;
impact: ImpactLevel;
likelihood: LikelihoodLevel;
controls: Control[];
}

enum ImpactLevel {
Low = 'Low',
Medium = 'Medium',
High = 'High',
Critical = 'Critical'
}

enum LikelihoodLevel {
Rare = 'Rare',
Unlikely = 'Unlikely',
Possible = 'Possible',
Likely = 'Likely',
NearCertain = 'Near Certain'
}

interface Control {
id: string;
description: string;
currentState: State;
targetState: State;
mitigationStrategy: MitigationStrategy;
}

enum State {
NotImplemented = 'Not Implemented',
InProgress = 'In Progress',
Implemented = 'Implemented',
Monitoring = 'Monitoring'
}

enum MitigationStrategy {
Preventive = 'Preventive',
Detective = 'Detective',
Corrective = 'Corrective',
Recovery = 'Recovery'
}

const threatModel: ThreatModel = {
id: '1',
name: 'Unauthorized Access',
description: 'An unauthenticated user gains access to sensitive data or functionality.',
impact: ImpactLevel.High,
likelihood: LikelihoodLevel.Likely,
controls: [
{
id: '1.1',
description: 'Implement strong authentication and authorization mechanisms.',
currentState: State.InProgress,
targetState: State.Implemented,
mitigationStrategy: MitigationStrategy.Preventive
},
{
id: '1.2',
description: 'Monitor for unusual login attempts and block suspicious IP addresses.',
currentState: State.Implemented,
targetState: State.Monitoring,
mitigationStrategy: MitigationStrategy.Detective
}
]
};
