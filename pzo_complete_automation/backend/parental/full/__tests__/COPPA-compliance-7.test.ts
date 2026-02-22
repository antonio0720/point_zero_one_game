import { test, expect } from '@jest/globals';
import { COPPACoppliance7 } from '../COPPA-compliance-7';

describe('COPPA Compliance 7', () => {
test('should check for age gating and parental controls', () => {
// Test case for successful age verification with correct age
const coppaCompliance = new COPPACoppliance7(18);
expect(coppaCompliance.isValid()).toBeTruthy();

// Test case for failed age verification with incorrect age
const coppaComplianceIncorrectAge = new COPPACoppliance7(13);
expect(coppaComplianceIncorrectAge.isValid()).toBeFalsy();
});

test('should check for parental controls', () => {
// Test case for successful parental control verification with enabled state
const coppaComplianceWithParentalControls = new COPPACoppliance7(18, true);
expect(coppaComplianceWithParentalControls.isValid()).toBeTruthy();

// Test case for failed parental control verification with disabled state
const coppaComplianceWithoutParentalControls = new COPPACoppliance7(18, false);
expect(coppaComplianceWithoutParentalControls.isValid()).toBeFalsy();
});
});
