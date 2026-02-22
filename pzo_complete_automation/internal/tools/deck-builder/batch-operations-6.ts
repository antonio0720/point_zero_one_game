import { BatchOperation } from '@deck-deploy/core';
import { DeckAsset, DeckDeployment, DeckManifest } from '@deck-deploy/sdk';

export class AddSlideWithSpeakerNotes extends BatchOperation<DeckDeployment> {
constructor(private readonly slides: string[], private readonly speakerNotes: string[]) {
super();
}

public async apply(deployment: DeckDeployment): Promise<DeckDeployment> {
const manifest = deployment.manifest as DeckManifest;

for (let i = 0; i < this.slides.length && i < manifest.slides.length; i++) {
const slide = manifest.slides[i];
slide.speakerNotes = this.speakerNotes[i] || '';
}

return deployment;
}
}

export class AddAsset extends BatchOperation<DeckDeployment> {
constructor(private readonly asset: DeckAsset) {
super();
}

public async apply(deployment: DeckDeployment): Promise<DeckDeployment> {
deployment.assets = [...(deployment.assets || []), this.asset];
return deployment;
}
}
