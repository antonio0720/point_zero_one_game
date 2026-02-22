import { Test, TestingModule } from '@nestjs/testing';
import { TaxComplianceService } from '../tax-compliance.service';
import { Vat3Calculator } from './vat-3.calculator';
import { v4 as uuidv4 } from 'uuid';

describe('Tax Compliance (VAT-3)', () => {
let taxComplianceService: TaxComplianceService;
let vat3Calculator: Vat3Calculator;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [TaxComplianceService, Vat3Calculator],
}).compile();

taxComplianceService = module.get<TaxComplianceService>(TaxComplianceService);
vat3Calculator = module.get<Vat3Calculator>(Vat3Calculator);
});

describe('VAT-3 Calculation', () => {
it('should calculate VAT-3 correctly for a single invoice', async () => {
const invoice = {
id: uuidv4(),
clientId: uuidv4(),
amount: 100,
vatRate: 20 / 100,
};

expect(await taxComplianceService.calculateVAT3([invoice])).toEqual({
id: invoice.id,
netAmount: invoice.amount,
vatAmount: invoice.amount * invoice.vatRate,
grossAmount: invoice.amount + (invoice.amount * invoice.vatRate),
});
});

it('should calculate VAT-3 correctly for multiple invoices', async () => {
const invoice1 = {
id: uuidv4(),
clientId: uuidv4(),
amount: 50,
vatRate: 20 / 100,
};

const invoice2 = {
id: uuidv4(),
clientId: uuidv4(),
amount: 75,
vatRate: 10 / 100,
};

expect(await taxComplianceService.calculateVAT3([invoice1, invoice2])).toEqual([
{
id: invoice1.id,
netAmount: invoice1.amount,
vatAmount: invoice1.amount * invoice1.vatRate,
grossAmount: invoice1.amount + (invoice1.amount * invoice1.vatRate),
},
{
id: invoice2.id,
netAmount: invoice2.amount,
vatAmount: invoice2.amount * invoice2.vatRate,
grossAmount: invoice2.amount + (invoice2.amount * invoice2.vatRate),
},
]);
});
});

describe('VAT-3 Total', () => {
it('should calculate VAT-3 total correctly for a single invoice', async () => {
const invoice = {
id: uuidv4(),
clientId: uuidv4(),
amount: 100,
vatRate: 20 / 100,
};

expect(await taxComplianceService.getTotalVAT3([invoice])).toEqual({
netAmount: invoice.amount,
vatAmount: invoice.amount * invoice.vatRate,
grossAmount: invoice.amount + (invoice.amount * invoice.vatRate),
});
});

it('should calculate VAT-3 total correctly for multiple invoices', async () => {
const invoice1 = {
id: uuidv4(),
clientId: uuidv4(),
amount: 50,
vatRate: 20 / 100,
};

const invoice2 = {
id: uuidv4(),
clientId: uuidv4(),
amount: 75,
vatRate: 10 / 100,
};

expect(await taxComplianceService.getTotalVAT3([invoice1, invoice2])).toEqual({
netAmount: invoice1.amount + invoice2.amount,
vatAmount: (invoice1.amount * invoice1.vatRate) + (invoice2.amount * invoice2.vatRate),
grossAmount:
invoice1.amount + (invoice1.amount * invoice1.vatRate) +
invoice2.amount + (invoice2.amount * invoice2.vatRate),
});
});
});

describe('VAT-3 Calculator', () => {
it('should calculate VAT-3 correctly for a single invoice', async () => {
const invoice = {
id: uuidv4(),
clientId: uuidv4(),
amount: 100,
vatRate: 20 / 100,
};

expect(await vat3Calculator.calculate(invoice)).toEqual({
id: invoice.id,
netAmount: invoice.amount,
vatAmount: invoice.amount * invoice.vatRate,
grossAmount: invoice.amount + (invoice.amount * invoice.vatRate),
});
});

it('should calculate VAT-3 correctly for multiple invoices', async () => {
const invoice1 = {
id: uuidv4(),
clientId: uuidv4(),
amount: 50,
vatRate: 20 / 100,
};

const invoice2 = {
id: uuidv4(),
clientId: uuidv4(),
amount: 75,
vatRate: 10 / 100,
};

expect(await vat3Calculator.calculate([invoice1, invoice2])).toEqual([
{
id: invoice1.id,
netAmount: invoice1.amount,
vatAmount: invoice1.amount * invoice1.vatRate,
grossAmount: invoice1.amount + (invoice1.amount * invoice1.vatRate),
},
{
id: invoice2.id,
netAmount: invoice2.amount,
vatAmount: invoice2.amount * invoice2.vatRate,
grossAmount: invoice2.amount + (invoice2.amount * invoice2.vatRate),
},
]);
});
});
});
