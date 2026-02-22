import { fraudDetection } from "../fraud-detection-9";
import { mockData } from "./__mocks__/mock-data";
import sinon from "sinon";

describe("Fraud Detection", () => {
let sandbox: any;

beforeEach(() => {
sandbox = sinon.createSandbox();
});

afterEach(() => {
sandbox.restore();
});

it("should return true for fraudulent transaction", () => {
const data = mockData.fraudulentTransaction;
const expectedResult = true;
const fraudDetectionSpy = sandbox.spy(fraudDetection, "execute");

fraudDetection(data);
expect(fraudDetectionSpy.calledOnce).toBeTruthy();
expect(fraudDetectionSpy.returnValues[0]).toEqual(expectedResult);
});

it("should return false for non-fraudulent transaction", () => {
const data = mockData.nonFraudulentTransaction;
const expectedResult = false;
const fraudDetectionSpy = sandbox.spy(fraudDetection, "execute");

fraudDetection(data);
expect(fraudDetectionSpy.calledOnce).toBeTruthy();
expect(fraudDetectionSpy.returnValues[0]).toEqual(expectedResult);
});

it("should call the execute method with correct arguments", () => {
const data = mockData.anyTransaction;
sandbox.stub(fraudDetection, "execute").returns(() => true);

fraudDetection(data);
const [args] = fraudDetection.execute.callArgs;
expect(args).toEqual(expect.arrayContaining([data]));
});
});
