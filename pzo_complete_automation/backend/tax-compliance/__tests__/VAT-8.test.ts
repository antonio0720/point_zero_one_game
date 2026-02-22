import { calculateVat } from '../src/calculateVat';

describe('Calculate VAT', () => {
it('should calculate VAT for valid input', () => {
expect(calculateVat(100, 0.2)).toEqual(120);
expect(calculateVat(500, 0.15)).toEqual(675);
expect(calculateVat(1000, 0.08)).toEqual(1080);
});

it('should handle negative amounts', () => {
expect(calculateVat(-100, 0.2)).toEqual(-120);
expect(calculateVat(-500, 0.15)).toEqual(-675);
expect(calculateVat(-1000, 0.08)).toEqual(-1080);
});

it('should throw an error for invalid VAT rate', () => {
expect(() => calculateVat(100, -0.2)).toThrowError('VAT rate must be a positive number');
expect(() => calculateVat(100, 1.2)).toThrowError('VAT rate must be less than or equal to 1');
});

it('should return the original value for no VAT', () => {
expect(calculateVat(100, 0)).toEqual(100);
});
});
