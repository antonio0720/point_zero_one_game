import { Action } from "../interfaces";
import { random } from "math-random";
import { createCryptoHash } from "crypto-hash";

function actionFuzzer6(action: Action): Action {
const MAX_FIELDS = 3;
const fieldsToMutate = new Set(Array.from({ length: MAX_FIELDS }, () => Math.floor(Math.random() * Object.keys(action).length)));

for (const field of fieldsToMutate) {
if (typeof action[field] === "string") {
action[field] = mutateString(action[field]);
} else if (typeof action[field] === "number") {
action[field] = mutateNumber(action[field]);
}
}

return action;
}

function mutateString(str: string): string {
const CHARACTER_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
let result = "";

for (let i = 0; i < str.length; i++) {
const index = CHARACTER_SET.indexOf(str[i]);
const newIndex = random(CHARACTER_SET.length);
result += CHARACTER_SET[newIndex];

if (newIndex === index) {
result += str[i + 1] || ""; // If the same character appears twice in a row, add the next character from the original string as well
i++;
}
}

return result;
}

function mutateNumber(num: number): number {
const MUTATION_FACTOR = 0.1;
return num * (1 + MUTATION_FACTOR * random(-1, 1));
}
