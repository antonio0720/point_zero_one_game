// tslint:disable:no-any strict-type-checking

export enum CoopContractType {
    Assist = 'assist',
    Sabotage = 'sabotage'
}

export interface ICoopContract {
    contractId: string;
    type: CoopContractType;
    targetPlayerId?: string;
    assistGiftTokenId?: string;
    sabotageTokenId?: string;
    mlEnabled: boolean;
    auditHash: string;
}

export class CoopContract implements ICoopContract {
    public contractId: string;
    public type: CoopContractType;
    public targetPlayerId?: string;
    public assistGiftTokenId?: string;
    public sabotageTokenId?: string;
    public mlEnabled: boolean;
    public auditHash: string;

    constructor(contractId: string, type: CoopContractType, targetPlayerId?: string, assistGiftTokenId?: string, sabotageTokenId?: string) {
        this.contractId = contractId;
        this.type = type;
        this.targetPlayerId = targetPlayerId;
        this.assistGiftTokenId = assistGiftTokenId;
        this.sabotageTokenId = sabotageTokenId;
        this.mlEnabled = false; // default to false
        this.auditHash = '';
    }

    public getAssistGiftTokenId(): string | undefined {
        return this.assistGiftTokenId;
    }

    public getSabotageTokenId(): string | undefined {
        return this.sabotageTokenId;
    }
}

export class CoopContractManager {
    private contracts: ICoopContract[] = [];

    public addContract(contract: ICoopContract): void {
        this.contracts.push(contract);
    }

    public getContracts(): ICoopContract[] {
        return this.contracts;
    }

    public getContractById(id: string): ICoopContract | undefined {
        return this.contracts.find((contract) => contract.contractId === id);
    }
}
