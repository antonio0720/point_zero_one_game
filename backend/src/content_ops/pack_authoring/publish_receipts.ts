/**
 * PublishReceipt represents a receipt for publishing content packs.
 */
export interface PublishReceipt {
  contentHash: string;
  versionPinSet: string[];
  publishActor: string;
  timestamp: Date;
}

/**
 * PublishReceiptsRepository is responsible for persisting and retrieving PublishReceipts.
 */
export interface PublishReceiptsRepository {
  save(receipt: PublishReceipt): Promise<void>;
  getLatestByContentHash(contentHash: string): Promise<PublishReceipt | null>;
}

/**
 * PublishReceiptsService manages the business logic for publishing content packs and creating receipts.
 */
export class PublishReceiptsService {
  constructor(private readonly repository: PublishReceiptsRepository) {}

  async publish(contentHash: string, versionPinSet: string[], publishActor: string): Promise<PublishReceipt> {
    const currentReceipt = await this.repository.getLatestByContentHash(contentHash);
    const newReceipt: PublishReceipt = { contentHash, versionPinSet, publishActor, timestamp: new Date() };

    if (currentReceipt) {
      // Handle version conflict logic here
    }

    await this.repository.save(newReceipt);
    return newReceipt;
  }
}
