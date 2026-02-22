import { Receipt } from "../receipts";
import { TaxComplianceService } from "../../tax-compliance";
import { TaxRate } from "../../tax-rates";

describe("Receipts - Test Case 10", () => {
let receipt: Receipt;
let taxComplianceService: TaxComplianceService;

beforeEach(() => {
receipt = new Receipt();
taxComplianceService = new TaxComplianceService(new TaxRate());
});

it("should calculate tax for receipt 10", () => {
receipt.addItem("Item A", 10, 5);
receipt.addItem("Item B", 20, 7);
receipt.addItem("Item C", 30, 9);

const taxAmount = taxComplianceService.calculateTax(receipt);

expect(taxAmount).toBeCloseTo(68.45);
});
});
