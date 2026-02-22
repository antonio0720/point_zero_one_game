import { ProvenanceManager } from "../../src/backend/ml/versioning";
import { Dataset, Version } from "../../src/backend/ml/datasets";
import { expect } from "chai";

describe("ProvenanceManager", () => {
let provenanceManager: ProvenanceManager;

beforeEach(() => {
provenanceManager = new ProvenanceManager();
});

it("should create a new dataset and version with correct provenance", () => {
const dataset = new Dataset("my-dataset");
const version = provenanceManager.createVersion(dataset);

expect(version.provenance).to.deep.equal({
creator: "",
timestamp: expect.a("string").that.matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
});
});

it("should update a version with correct provenance", () => {
const dataset = new Dataset("my-dataset");
const initialVersion = provenanceManager.createVersion(dataset);
const updatedDataset = { ...dataset, name: "updated-name" };
const updatedVersion = provenanceManager.updateVersion(initialVersion, updatedDataset);

expect(updatedVersion.provenance).to.deep.equal({
creator: initialVersion.creator,
timestamp: expect.a("string").that.matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
});
});

it("should get the latest version of a dataset", () => {
const dataset = new Dataset("my-dataset");
provenanceManager.createVersion(dataset);
provenanceManager.createVersion(dataset);
const latestVersion = provenanceManager.getLatestVersion(dataset.id);

expect(latestVersion).to.exist;
});

it("should get the history of a dataset", () => {
const dataset = new Dataset("my-dataset");
const versionsCount = 5;
for (let i = 0; i < versionsCount; i++) {
provenanceManager.createVersion(dataset);
}
const versionHistory = provenanceManager.getHistory(dataset.id);

expect(versionHistory.length).to.equal(versionsCount);
});
});
