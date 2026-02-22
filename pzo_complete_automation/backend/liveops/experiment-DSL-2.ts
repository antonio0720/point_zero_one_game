interface Experiment {
id: string;
name: string;
startTime?: Date;
endTime?: Date;
targetPopulation: string;
controlVariants: ControlVariant[];
treatmentVariants: TreatmentVariant[];
}

interface ControlVariant {
id: string;
variantId: string;
weight: number;
}

interface TreatmentVariant {
id: string;
variantId: string;
weight: number;
rolloutTime?: Date;
}

function createExperiment(id: string, name: string, targetPopulation: string): Experiment {
return {
id,
name,
targetPopulation,
controlVariants: [],
treatmentVariants: []
};
}

function addControlVariant(experiment: Experiment, id: string, variantId: string, weight: number) {
experiment.controlVariants.push({id, variantId, weight});
}

function addTreatmentVariant(experiment: Experiment, id: string, variantId: string, weight: number, rolloutTime?: Date) {
experiment.treatmentVariants.push({id, variantId, weight, rolloutTime});
}
