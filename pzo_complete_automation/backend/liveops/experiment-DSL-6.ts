import { Experiment } from '@liveops/experiment-sdk';

export class MyExperiment extends Experiment {
constructor() {
super({
name: 'my-experiment',
description: 'This is a sample experiment.',
target: {
audience: 'all', // or specific audience based on your needs
},
variants: [
{
id: 'control',
weight: 50,
treatment: {}, // any additional configuration for the control group
},
{
id: 'test',
weight: 50,
treatment: {
// additional configuration for test group
},
},
],
});
}
}
