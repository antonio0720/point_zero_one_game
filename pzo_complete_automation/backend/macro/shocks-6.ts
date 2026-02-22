import * as fs from 'fs';
import * as path from 'path';
import * as rts from 'rts';
import * as yup from 'yup';

const schema = yup.object().shape({
c: yup.number().required(),
i: yup.number().required(),
g: yup.number().required(),
t: yup.number().required(),
r: yup.number().required(),
Y: yup.number().required(),
L: yup.number().required(),
MPS: yup.number().required(),
mpc: yup.number().required(),
});

interface Parameters {
c: number;
i: number;
g: number;
t: number;
r: number;
Y: number;
L: number;
MPS: number;
mpc: number;
}

function isModel(obj: any): obj is Parameters {
return schema.isValidSync(obj);
}

const interestRateFunction = (Y: number, r: number, MPS: number) =>
(r - MPS * Y) / (1 - MPS);

const consumptionFunction = (Y: number, c: number, mpc: number) => c * mpc * Y;

const investmentFunction = (r: number, i: number) => i * r;

const governmentSpendingFunction = (t: number, g: number) => g * t;

function simulate(params: Parameters, shocks: any): void {
const { c, i, g, r, Y, L, MPS, mpc } = params;

// Assume initial values for income (Y), interest rate (r), and consumption (C)
let rCurrent = r;
let YCurrent = Y;
let CCurrent = consumptionFunction(YCurrent, c, mpc);
const ICurrent = investmentFunction(rCurrent, i);
const GCurrent = governmentSpendingFunction(1, g);
const NCurrent = L - CCurrent - ICurrent - GCurrent; // Net exports

while (true) {
const rNext = interestRateFunction(YCurrent, rCurrent, MPS);
YCurrent = (CCurrent + ICurrent + GCurrent + NCurrent) / (1 + MPS);
CCurrent = consumptionFunction(YCurrent, c, mpc);

// Apply shock to savings and check for convergence
if (Math.abs(rNext - rCurrent) < 0.01) break;
rCurrent = rNext;
}

// Handle shocks
const consumptionShock = shocks['consumption'];
CCurrent += consumptionShock * c * YCurrent;

// Recalculate and return new equilibrium values
const INext = investmentFunction(rCurrent, i);
const GNext = governmentSpendingFunction(1, g);
const NNext = L - CCurrent - INext - GNext;
const YNext = (CCurrent + INext + GNext + NNext) / (1 + MPS);

console.log({ Y: YNext, r: rCurrent });
}

const paramsPath = path.join(__dirname, 'params.json');
const shocksPath = path.join(__dirname, 'shocks.json');

fs.readFile(paramsPath, (err, data) => {
if (err) throw err;
const params: Parameters = JSON.parse(data.toString());

fs.readFile(shocksPath, (err, data) => {
if (err) throw err;
const shocks: any = JSON.parse(data.toString());

simulate(params, shocks);
});
});
