type CoopContract = {
// ... (other properties)
clauseFour: {
memberContribution: number;
totalAmount: number;
repaymentSchedule: RepaymentSchedule;
};
};

interface RepaymentSchedule {
intervals: number[];
amounts: number[];
}

const createCoopContract = (): CoopContract => ({
// ... (other properties)
clauseFour: {
memberContribution: 0,
totalAmount: 0,
repaymentSchedule: {
intervals: [],
amounts: [],
},
},
});

const updateMemberContribution = (contract: CoopContract, memberId: number, contribution: number) => {
contract.clauseFour.memberContribution = contribution;
};

const updateTotalAmount = (contract: CoopContract, total: number) => {
contract.clauseFour.totalAmount = total;
};

const addRepaymentIntervalAndAmount = (
contract: CoopContract,
interval: number,
amount: number
): void => {
contract.clauseFour.repaymentSchedule.intervals.push(interval);
contract.clauseFour.repaymentSchedule.amounts.push(amount);
};
