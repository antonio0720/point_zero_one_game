/**
 * Billing usage counters and invoicing service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Invoice, InvoiceDocument } from './invoices.schema';
import { UsageCounter, UsageCounterDocument } from './usage-counters.schema';

/**
 * Mongoose schema for game usage counters
 */
export const usageCountersSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  playerId: { type: String, required: true },
  action: { type: String, required: true },
  count: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

usageCountersSchema.index({ gameId: 1, playerId: 1 });
usageCountersSchema.index({ gameId: 1, action: 1 });

export interface UsageCounter extends Document {
  gameId: string;
  playerId: string;
  action: string;
  count: number;
  timestamp: Date;
}

/**
 * Mongoose schema for invoices
 */
export const invoiceSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  playerId: { type: String, required: true },
  usageCounters: [usageCountersSchema],
  totalAmount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

invoiceSchema.index({ gameId: 1, playerId: 1 });
invoiceSchema.index({ 'usageCounters.action': 1, 'usageCounters.gameId': 1 });

export interface Invoice extends Document {
  gameId: string;
  playerId: string;
  usageCounters: UsageCounter[];
  totalAmount: number;
  createdAt: Date;
}

/**
 * Billing service for tracking and invoicing game usage
 */
@Injectable()
export class BillingService {
  constructor(
    @InjectModel(UsageCounter.name) private readonly usageCounterModel: Model<UsageCounterDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>
  ) {}

  /**
   * Increment the usage counter for a specific game, player, and action
   */
  async incrementCounter(gameId: string, playerId: string, action: string): Promise<void> {
    const existingCounter = await this.usageCounterModel.findOneAndUpdate(
      { gameId, playerId, action },
      { $inc: { count: 1 } },
      { upsert: true, new: true }
    );
  }

  /**
   * Generate an invoice for a specific game and player
   */
  async generateInvoice(gameId: string, playerId: string): Promise<Invoice> {
    const usageCounters = await this.usageCounterModel.find({ gameId, playerId }).exec();
    const totalAmount = usageCounters.reduce((total, counter) => total + counter.count, 0);

    const invoice = new this.invoiceModel({
      gameId,
      playerId,
      usageCounters,
      totalAmount,
    });

    return invoice.save();
  }
}
