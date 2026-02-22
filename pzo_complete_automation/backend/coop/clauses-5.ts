export interface CoopContract {
id: number;
memberId: number;
contractType: string;
startDate: Date;
endDate: Date;
clauses: Clauses5[];
}

interface Clauses5 {
clauseNumber: number;
clauseText: string;
}

const CLAUSE_5_1: Clauses5 = {
clauseNumber: 1,
clauseText: 'The co-op member must maintain a minimum balance as required by the co-op.',
};

const CLAUSE_5_2: Clauses5 = {
clauseNumber: 2,
clauseText: 'The co-op member is responsible for any loans or debts incurred during their membership.',
};

const CLAUSE_5_3: Clauses5 = {
clauseNumber: 3,
clauseText: 'The co-op member agrees to participate in the co-op's decision-making processes.',
};

const CLAUSE_5_4: Clauses5 = {
clauseNumber: 4,
clauseText: 'The co-op member understands that their membership can be terminated for cause or without cause as per the co-op bylaws.',
};

const CLAUSE_5_5: Clauses5 = {
clauseNumber: 5,
clauseText: 'The co-op member is responsible for any damages to the co-op property that they may cause.',
};
