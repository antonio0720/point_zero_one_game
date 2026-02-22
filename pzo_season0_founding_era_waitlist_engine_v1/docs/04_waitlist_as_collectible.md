# Waitlist as Collectible

A collectible representation of your place in the Point Zero One Digital (PZO) founding era waitlist. Each collectible is unique and non-transferable, serving as a proof of early access to the Sovereign infrastructure architect design game, _Sovereign_.

## Non-negotiables

1. **Scarcity**: Only a limited number of collectibles will be issued, reflecting the exclusivity of the founding era.
2. **Non-repurchasable**: Once claimed, a collectible cannot be repurchased or duplicated.
3. **Upgradeable**: As the game evolves, collectibles may become eligible for upgrades, enhancing their value and benefits.
4. **Receipts**: Each collectible includes a receipt detailing the transaction history, including the date of purchase and any subsequent upgrades.
5. **Community**: Ownership of a collectible grants access to an exclusive community of early adopters, fostering collaboration and camaraderie among members.

## Implementation Spec

Each collectible is represented as a share object in TypeScript, strictly adhering to strict-mode and avoiding the use of 'any'. The share object includes the following properties:

1. `id`: A unique identifier for the collectible.
2. `owner`: The wallet address of the current owner.
3. `tier`: The tier level of the collectible, indicating its rarity and potential upgrades.
4. `transactionHistory`: An array of objects detailing each transaction associated with the collectible. Each object includes properties for the date of the transaction, the type of transaction (purchase or upgrade), and any additional details.
5. `communityAccess`: A boolean indicating whether the owner has access to the exclusive community.

## Edge Cases

1. **Multiple Purchases**: If a user attempts to purchase multiple collectibles, only the first purchase will be processed, and subsequent attempts will be rejected.
2. **Duplicate Collectibles**: In the event of a system error leading to duplicate collectibles, the duplicates will be automatically destroyed, and the affected users will be notified and compensated accordingly.
3. **Upgrade Eligibility**: Upgrades may only be applied if the user owns a collectible of the required tier or higher. If an attempt is made to upgrade an ineligible collectible, the transaction will be rejected, and the user will be notified.
4. **Community Access**: Users who no longer own a collectible will lose access to the exclusive community.
