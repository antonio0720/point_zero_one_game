type Member = {
id: number;
name: string;
}

type CoopContract = {
id: number;
memberId: number;
memberName: string;
startDate: Date;
endDate: Date;
clauses: Clause[];
}

interface Clause {
clauseNumber: number;
description: string;
}

const clause9: Clause = {
clauseNumber: 9,
description: 'The member agrees to contribute a pre-determined percentage of their earnings to the cooperative.',
};

function createCoopContract(member: Member, startDate: Date, endDate: Date): CoopContract {
const coopContract: CoopContract = {
id: Math.floor(Math.random() * 10000),
memberId: member.id,
memberName: member.name,
startDate,
endDate,
clauses: [clause9],
};
return coopContract;
}
