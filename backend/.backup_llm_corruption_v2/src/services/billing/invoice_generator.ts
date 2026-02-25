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
```

SQL (PostgreSQL):

```sql
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  partner_id VARCHAR(255) NOT NULL,
  invoice_number INTEGER UNIQUE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_partner FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS line_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id),
  // ... other columns and indexes
);

CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  // ... other columns and indexes
);

CREATE TABLE IF NOT EXISTS audit_receipts (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id),
  // ... other columns and indexes
);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail
echo "Generating invoice"
# ... (commands for generating invoice, line items, partners, and audit receipts)
```

Terraform:

```hcl
resource "aws_rds_instance" "invoices" {
  // ... required fields for production-ready RDS instance
}

resource "aws_rds_table" "invoices" {
  name           = "invoices"
  read_replica_identifier = "${aws_rds_instance.invoices.id}-read-replica"
  engine         = "postgres"
  engine_version = "13.2"
  instance       = aws_rds_instance.invoices.id
  // ... other required fields for production-ready RDS table
}

// ... (resources for line items, partners, and audit receipts)
