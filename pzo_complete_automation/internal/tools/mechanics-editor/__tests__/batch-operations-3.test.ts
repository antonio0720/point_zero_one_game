import { MechanicsEditor, BatchOperations, IEntity, EntityKind } from '../mechanics-editor';
import { World, Entity } from 'ammo';
import * as assert from 'assert';

describe('Batch Operations', () => {
let editor: MechanicsEditor;
let world: World;

beforeEach(() => {
editor = new MechanicsEditor();
world = new World();
});

it('should correctly apply batch operations', () => {
// Create entities to be used in the test
const entity1 = new Entity({ mass: 1, position: [0, 0, 0] });
const entity2 = new Entity({ mass: 2, position: [5, 0, 0] });
world.add(entity1);
world.add(entity2);
editor.initializeWorld(world);

// Create a new BatchOperations instance and add some operations
const batchOps = new BatchOperations();
batchOps.addOperation('translate', [entity1.id, 3, 0, 0]);
batchOps.addOperation('rotate', [entity2.id, 0, Math.PI / 4, 0, 1, 0, 0]);

// Apply the batch operations and check the results
editor.applyBatchOperations(batchOps);
const entities = editor.getEntities();
const entity1Position = entities[entity1.id].position;
const entity2Position = entities[entity2.id].position;

assert.deepStrictEqual(entity1Position, [3, 0, 0]);
assert.deepStrictEqual(entity2Position, [-3.414213562373095, 0, 0]);
});

it('should correctly handle missing entities in batch operations', () => {
// Create a new BatchOperations instance and add some operations with a non-existing entity
const batchOps = new BatchOperations();
batchOps.addOperation('translate', [100, 3, 0, 0]);

// Apply the batch operations and check that no error is thrown
editor.applyBatchOperations(batchOps);
});
});
