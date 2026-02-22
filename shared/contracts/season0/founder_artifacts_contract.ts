/**
 * Founder Artifacts Contract
 */

import { Contract, Address, BigInt } from "@graphprotocol/graph-ts";

export class FounderArtifactsContract extends Contract {
  // Title Payloads
  public TITLE_PAYLOADS: Map<Address, TitlePayload> = new Map<Address, TitlePayload>();

  constructor() {
    super();
  }

  /**
   * Mints a new title payload for the given founder address.
   */
  public mintTitle(founder: Address, titleId: BigInt): void {
    let titlePayload = new TitlePayload(titleId);
    titlePayload.founder = founder;
    titlePayload.save();
    this.TITLE_PAYLOADS.set(founder, titlePayload);
  }

  /**
   * Retrieves the title payload for the given founder address.
   */
  public getTitleByFounder(founder: Address): TitlePayload | null {
    return this.TITLE_PAYLOADS.get(founder);
  }

  // Cosmetic Payloads
  public COSMETIC_PAYLOADS: Map<Address, CosmeticPayload> = new Map<Address, CosmeticPayload>();

  /**
   * Mints a new cosmetic payload for the given founder address.
   */
  public mintCosmetic(founder: Address, cosmeticId: BigInt): void {
    let cosmeticPayload = new CosmeticPayload(cosmeticId);
    cosmeticPayload.founder = founder;
    cosmeticPayload.save();
    this.COSMETIC_PAYLOADS.set(founder, cosmeticPayload);
  }

  /**
   * Retrieves the cosmetic payload for the given founder address.
   */
  public getCosmeticByFounder(founder: Address): CosmeticPayload | null {
    return this.COSMETIC_PAYLOADS.get(founder);
  }

  // Stamp Payloads
  public STAMP_PAYLOADS: Map<Address, StampPayload> = new Map<Address, StampPayload>();

  /**
   * Mints a new stamp payload for the given founder address.
   */
  public mintStamp(founder: Address, stampId: BigInt): void {
    let stampPayload = new StampPayload(stampId);
    stampPayload.founder = founder;
    stampPayload.save();
    this.STAMP_PAYLOADS.set(founder, stampPayload);
  }

  /**
   * Retrieves the stamp payload for the given founder address.
   */
  public getStampByFounder(founder: Address): StampPayload | null {
    return this.STAMP_PAYLOADS.get(founder);
  }
}

// Title Payload
export class TitlePayload extends Contract {
  public id: BigInt;
  public founder: Address;

  constructor(id: BigInt) {
    super();
    self.id = id;
  }

  // Upgrade Variants
  public UPGRADE_VARIANTS: Map<BigInt, TitleUpgradeVariant> = new Map<BigInt, TitleUpgradeVariant>();

  /**
   * Adds an upgrade variant for the title.
   */
  public addUpgrade(variantId: BigInt, variant: TitleUpgradeVariant): void {
    this.UPGRADE_VARIANTS.set(variantId, variant);
  }

  /**
   * Retrieves an upgrade variant for the title.
   */
  public getUpgrade(variantId: BigInt): TitleUpgradeVariant | null {
    return this.UPGRADE_VARIANTS.get(variantId);
  }
}

// Cosmetic Payload
export class CosmeticPayload extends Contract {
  public id: BigInt;
  public founder: Address;

  constructor(id: BigInt) {
    super();
    self.id = id;
  }

  // Upgrade Variants
  public UPGRADE_VARIANTS: Map<BigInt, CosmeticUpgradeVariant> = new Map<BigInt, CosmeticUpgradeVariant>();

  /**
   * Adds an upgrade variant for the cosmetic.
   */
  public addUpgrade(variantId: BigInt, variant: CosmeticUpgradeVariant): void {
    this.UPGRADE_VARIANTS.set(variantId, variant);
  }

  /**
   * Retrieves an upgrade variant for the cosmetic.
   */
  public getUpgrade(variantId: BigInt): CosmeticUpgradeVariant | null {
    return this.UPGRADE_VARIANTS.get(variantId);
  }
}

// Stamp Payload
export class StampPayload extends Contract {
  public id: BigInt;
  public founder: Address;

  constructor(id: BigInt) {
    super();
    self.id = id;
  }

  // Upgrade Variants
  public UPGRADE_VARIANTS: Map<BigInt, StampUpgradeVariant> = new Map<BigInt, StampUpgradeVariant>();

  /**
   * Adds an upgrade variant for the stamp.
   */
  public addUpgrade(variantId: BigInt, variant: StampUpgradeVariant): void {
    this.UPGRADE_VARIANTS.set(variantId, variant);
  }

  /**
   * Retrieves an upgrade variant for the stamp.
   */
  public getUpgrade(variantId: BigInt): StampUpgradeVariant | null {
    return this.UPGRADE_VARIANTS.get(variantId);
  }
}

// Title Upgrade Variant
export class TitleUpgradeVariant {
  public id: BigInt;
  public name: string;
  public description: string;
  public imageUrl: string;
  public rarity: number;
  public multiplier: BigInt;

  constructor(id: BigInt, name: string, description: string, imageUrl: string, rarity: number, multiplier: BigInt) {
    self.id = id;
    self.name = name;
    self.description = description;
    self.imageUrl = imageUrl;
    self.rarity = rarity;
    self.multiplier = multiplier;
  }
}

// Cosmetic Upgrade Variant
export class CosmeticUpgradeVariant {
  public id: BigInt;
  public name: string;
  public description: string;
  public imageUrl: string;
  public rarity: number;

  constructor(id: BigInt, name: string, description: string, imageUrl: string, rarity: number) {
    self.id = id;
    self.name = name;
    self.description = description;
    self.imageUrl = imageUrl;
    self.rarity = rarity;
  }
}

// Stamp Upgrade Variant
export class StampUpgradeVariant {
  public id: BigInt;
  public name: string;
  public description: string;
  public imageUrl: string;
  public rarity: number;

  constructor(id: BigInt, name: string, description: string, imageUrl: string, rarity: number) {
    self.id = id;
    self.name = name;
    self.description = description;
    self.imageUrl = imageUrl;
    self.rarity = rarity;
  }
}
