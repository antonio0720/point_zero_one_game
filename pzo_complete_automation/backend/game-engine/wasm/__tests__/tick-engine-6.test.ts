import { assertEquals } from 'https://deno.land/std@0.145.0/testing/asserts.ts';
import { GameObject } from '../game-object.ts';
import { TickEngine } from './tick-engine-6.ts';

Deno.test('deterministic run engine - tick-engine-6', () => {
const engine = new TickEngine();

// Test case 1
const object1 = new GameObject(0, 0);
engine.register(object1);
object1.position = { x: 1, y: 2 };
engine.tick();
assertEquals(object1.position, { x: 1, y: 2 });

// Test case 2
const object2 = new GameObject(3, 4);
engine.register(object2);
object2.velocity = { dx: 5, dy: 6 };
engine.tick();
assertEquals(object2.position, { x: 8, y: 10 });

// Test case 3
const object3 = new GameObject(7, 11);
engine.register(object3);
object3.velocity = { dx: -3, dy: -2 };
engine.tick();
assertEquals(object3.position, { x: 4, y: 9 });
});
