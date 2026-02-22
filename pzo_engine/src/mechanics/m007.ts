// pzo_engine/src/mechanics/m007.ts

export class LeveragePurchaseResolverBuffOrder {
    private readonly mlEnabled: boolean;
    private readonly auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this.mlEnabled = mlEnabled;
        this.auditHash = auditHash;
    }

    public resolve(
        leveragePurchase: any,
        playerState: any,
        gameSettings: any
    ): { outcome: number; message: string } {
        if (!this.mlEnabled) {
            return {
                outcome: 0,
                message: "Leverage Purchase Resolver (Buff Order): ML is disabled",
            };
        }

        const leveragePurchaseAmount = leveragePurchase.amount;
        const playerNetWorth = playerState.netWorth;

        if (leveragePurchaseAmount > playerNetWorth) {
            return {
                outcome: 0,
                message:
                    "Leverage Purchase Resolver (Buff Order): Insufficient funds",
            };
        }

        // Calculate the leverage multiplier
        const leverageMultiplier =
            gameSettings.leverageMultiplier *
            (1 + gameSettings.buffOrderBonus);

        // Apply the leverage multiplier to the player's net worth
        const newNetWorth = playerNetWorth * leverageMultiplier;

        // Update the player's state with the new net worth
        playerState.netWorth = newNetWorth;

        return {
            outcome: 1,
            message:
                "Leverage Purchase Resolver (Buff Order): Leverage applied successfully",
        };
    }
}
