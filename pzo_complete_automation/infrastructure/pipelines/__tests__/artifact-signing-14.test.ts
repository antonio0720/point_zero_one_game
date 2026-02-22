import { ArtifactSigner } from '../artifact-signing';
import { SigningUtils } from '../signing-utils';
import { Artifact } from '../../interfaces/artifact';
import { expect } from 'chai';
import 'mocha';

describe('ArtifactSigner', () => {
const artifact: Artifact = {
name: 'my-artifact',
content: 'test data'
};

let signer: ArtifactSigner;
let signingUtils: SigningUtils;

beforeEach(() => {
signingUtils = new SigningUtils();
signer = new ArtifactSigner(signingUtils);
});

it('should sign an artifact and return a signed one', async () => {
const signedArtifact = await signer.sign(artifact);
expect(signedArtifact.signature).not.to.be.null;
});

it('should verify a signed artifact is valid', async () => {
const signedArtifact = await signer.sign(artifact);
const verifiedArtifact = await signer.verifySignature(signedArtifact);
expect(verifiedArtifact).to.deep.equal(artifact);
});
});
