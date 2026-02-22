import { EmergencyLiquidity2 } from '../emergency-liquidity-2';
import { expect } from 'chai';
import { describe, it } from 'mocha';

describe('EmergencyLiquidity2', () => {
const companion = new EmergencyLiquidity2();

it('should calculate emergency liquidity correctly', () => {
expect(companion.calculateEmergencyLiquidity(100, 5)).to.equal(60); // replace with appropriate test case values
});

it('should handle negative asset value', () => {
expect(companion.calculateEmergencyLiquidity(-100, 5)).to.equal(Infinity); // replace with appropriate test case values
});

it('should handle zero risk-free rate', () => {
expect(companion.calculateEmergencyLiquidity(100, 0)).to.be.closeTo(100, 0.01); // replace with appropriate test case values
});
});
