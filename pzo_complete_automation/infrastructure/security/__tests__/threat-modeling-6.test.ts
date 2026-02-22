import { ThreatModel } from '../../src/infrastructure/security/threat-modeling';
import { Vulnerability, Threat, Control, Asset } from '../../src/interfaces';

describe('Threat Modeling - Security Hardening', () => {
let threatModel: ThreatModel;

beforeEach(() => {
threatModel = new ThreatModel();
});

it('should create a ThreatModel instance', () => {
expect(threatModel).toBeInstanceOf(ThreatModel);
});

it('should add a new asset to the model', () => {
const asset: Asset = { id: '1', name: 'Application' };
threatModel.addAsset(asset);
expect(threatModel.assets.includes(asset)).toBeTruthy();
});

it('should add a new threat to the model', () => {
const threat: Threat = { id: '1', name: 'SQL Injection' };
threatModel.addThreat(threat);
expect(threatModel.threats.includes(threat)).toBeTruthy();
});

it('should add a new vulnerability to the model', () => {
const vulnerability: Vulnerability = { id: '1', name: 'Unvalidated user input' };
threatModel.addVulnerability(vulnerability);
expect(threatModel.vulnerabilities.includes(vulnerability)).toBeTruthy();
});

it('should add a new control to the model', () => {
const control: Control = { id: '1', name: 'Input validation' };
threatModel.addControl(control);
expect(threatModel.controls.includes(control)).toBeTruthy();
});

it('should associate a vulnerability with a threat and an asset', () => {
const asset: Asset = { id: '1', name: 'Application' };
const threat: Threat = { id: '1', name: 'SQL Injection' };
const vulnerability: Vulnerability = { id: '1', name: 'Unvalidated user input' };

threatModel.addAsset(asset);
threatModel.addThreat(threat);
threatModel.addVulnerability(vulnerability);

threatModel.associateVulnerabilityWithThreatAndAsset(vulnerability, threat, asset);

expect(threatModel.getAssociatedVulnerabilities(threat)).toContain(vulnerability);
expect(threatModel.getAssociatedAssets(vulnerability)).toContain(asset);
});
});
