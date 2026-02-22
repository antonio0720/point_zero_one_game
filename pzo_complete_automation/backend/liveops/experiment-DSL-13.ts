import { Experiment, Variation } from './experiment';

class ExperimentDSLV13 implements Experiment {
private id: string;
private name: string;
private variations: Map<string, Variation>;

constructor(id: string, name: string) {
this.id = id;
this.name = name;
this.variations = new Map();
}

addVariation(variationId: string, variation: Variation): void {
this.variations.set(variationId, variation);
}

getId(): string {
return this.id;
}

getName(): string {
return this.name;
}

getVariations(): Map<string, Variation> {
return this.variations;
}
}
