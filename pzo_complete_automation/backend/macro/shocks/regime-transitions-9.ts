import { System } from "single-operator-split-step";
import { Matrix4 } from "matrix4";
import { Vector4 } from "vector4";

class RegimeTransitions9 extends System {
// Constants
private K = new Matrix4([
[2.0, -3.0, 3.0, -1.0],
[-7.0, 12.0, -6.0, 2.0],
[12.0, -19.0, 7.0, -1.0],
[-6.0, 9.0, -2.0, 0.5],
]);
private a = new Vector4([0.0, 1.0, 0.0, 0.0]);
private b = new Vector4([-1.0, -1.0, 1.0, 1.0]);
private c = new Vector4([1.0, -2.0, -1.0, 0.5]);

// State variables
stateVariables = ["x", "y", "z", "w"];

// Initial condition
initialCondition(t: number) {
return new Vector4([Math.sin(t), Math.cos(t), Math.sin(2 * t), Math.cos(2 * t)]);
}

// Time stepper function
timeStepper(state: Vector4, t: number, dt: number): Vector4 {
const result = this.K.multiply(state).add(this.a).add(this.b.multiply(t)).add(this.c);
return result;
}
}

// Initialize the simulation
const model = new RegimeTransitions9();
model.integrate({ stepSize: 0.1, endTime: 10 });
