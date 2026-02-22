import { EmergencyLiquidity } from '../emergency-liquidity';
import { StockData } from '../../data/stock-data';
import { expect } from 'chai';
import 'mocha';

describe('Emergency Liquidity', () => {
let emergencyLiquidity: EmergencyLiquidity;
let stockData: StockData;

beforeEach(() => {
emergencyLiquidity = new EmergencyLiquidity();
stockData = new StockData([
// Sample stock data here
]);
});

it('should calculate emergency liquidity correctly', () => {
const emergencyLiquidityValue = emergencyLiquidity.calculate(stockData);
expect(emergencyLiquidityValue).to.be.above(0);
});

it('should return an error message when there is no stock data', () => {
stockData = null;
const result = emergencyLiquidity.calculate(stockData as any);
expect(result).to.equal('Error: No stock data provided');
});
});
