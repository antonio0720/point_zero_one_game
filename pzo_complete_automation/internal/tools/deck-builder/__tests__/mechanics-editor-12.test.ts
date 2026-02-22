import { MechanicsEditor } from '../../src/mechanics-editor';
import { SampleMechanic1 } from '../mocks/sample-mechanic-1';
import { SampleMechanic2 } from '../mocks/sample-mechanic-2';

describe('Mechanics Editor', () => {
let mechanicsEditor: MechanicsEditor;

beforeEach(() => {
mechanicsEditor = new MechanicsEditor();
});

it('should add and remove mechanics correctly', () => {
mechanicsEditor.addMechanic(new SampleMechanic1());
expect(mechanicsEditor.getMechanics().length).toEqual(1);

mechanicsEditor.removeMechanic(SampleMechanic1);
expect(mechanicsEditor.getMechanics().length).toEqual(0);
});

it('should execute mechanics in the correct order', () => {
mechanicsEditor.addMechanic(new SampleMechanic1());
mechanicsEditor.addMechanic(new SampleMechanic2());

// Assuming your mechanics have an 'execute' method for testing
mechanicsEditor.execute();

// Add your assertions here based on the expected behavior of the mocks
});
});
