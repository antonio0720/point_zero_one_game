/**
 * Invoice Generator Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Invoice, InvoiceDocument } from './invoice.schema';
import { LineItem, LineItemDocument } from '../line-item/line-item.schema';
import { Partner, PartnerDocument } from '../partners/partner.schema';
import { AuditReceipt, AuditReceiptDocument } from '../audit-receipts/audit-receipt.schema';

/** Invoice Interface */
export interface IInvoice extends Document {
  partnerId: string;
  invoiceNumber: number;
  totalAmount: number;
  lineItems: LineItemDocument[];
  auditReceipts: AuditReceiptDocument[];
  createdAt: Date;
  updatedAt: Date;
}

/** Invoice Schema */
export type InvoiceSchema = Document & IInvoice;

@Injectable()
export class InvoiceGeneratorService {
  constructor(
    @InjectModel(Invoice.name) private invoiceModel: Model<IInvoice>,
    @InjectModel(LineItem.name) private lineItemModel: Model<Document>,
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    @InjectModel(AuditReceipt.name) private auditReceiptModel: Model<AuditReceiptDocument>,
  ) {}

  // ... (methods for generating invoices, line items, partners, and audit receipts)
}

// Mongoose Schema for Invoice
const InvoiceSchema = new mongoose.Schema({
  partnerId: { type: String, required: true },
  invoiceNumber: { type: Number, required: true, unique: true },
  totalAmount: { type: Number, required: true },
  lineItems: [{ type: LineItem.schema.obj, ref: 'LineItem' }],
  auditReceipts: [{ type: AuditReceipt.schema.obj, ref: 'AuditReceipt' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

InvoiceSchema.index({ partnerId: 1, invoiceNumber: 1 }, { unique: true });

export default InvoiceSchema;

