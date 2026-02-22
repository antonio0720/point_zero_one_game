import { FuzzySet } from "fuzzyset";
import { expect } from "@jest/globals";
import { Person } from "./person";

const people = [
new Person("Alice", 25),
new Person("Bob", 30),
new Person("Charlie", 28),
new Person("David", 24),
new Person("Eve", 26),
new Person("Frank", 29),
];

const nameSet = new FuzzySet(people.map((p) => p.name));

describe("Fairness Validation", () => {
test("Validates fairness in age distribution for similar names", () => {
const similiarNames = nameSet.get("A*", { limit: 5 });
const ageGroups = [...new Map(similiarNames.map((name) => [name, []])].values()];

people.forEach((person) => {
const matchedName = similiarNames.find((n) => n === person.name);
expect(ageGroups[matchedName]).toContainExpectedAge(person.age);
});
});

test("Validates fairness in age distribution for different names", () => {
const [aliceGroup, bobGroup] = [...new Map(people.map((p) => [p.name, []])).values()];

aliceGroup.push(...similiarNames.filter((n) => n !== "Alice"));
bobGroup.push(...similiarNames.filter((n) => n !== "Bob"));

expect(aliceGroup).toHaveApproximatelyEqualAgeDistribution(bobGroup);
});

const toHaveApproximatelyEqualAgeDistribution = (received: Person[], ...expectedGroups: Person[][]) => {
const histograms = [
new Map<number, number>(),
...expectedGroups.map((group) => new Map<number, number>()),
];

people.forEach((person) => {
const groupIndex = person.name === "Alice" ? 0 : expectedGroups.findIndex((g) => g.includes(person.name)) + 1;
histograms[groupIndex].set(person.age, (histograms[groupIndex].get(person.age) || 0) + 1);
});

let totalDeviation = 0;

for (let i = Math.min(...expectedGroups.map((g) => g[0].age)); i <= Math.max(...expectedGroups.map((g) => g[g.length - 1].age)); i++) {
const receivedCount = histograms[0].get(i) || 0;
const expectedCounts = expectedGroups.map((g) => histograms[g.length + 1][i] || 0);
totalDeviation += Math.pow(receivedCount - ...expectedCounts, 2);
}

return {
message: () => `Expected approximately equal age distribution between Alice and the other people.\n\tReceived:\n\t${JSON.stringify(histograms[0])}\n\texpected:\n\t${expectedGroups.map((g) => JSON.stringify(histograms[g.length + 1])).join("\n")}`,
pass: totalDeviation < 2, // Adjust the threshold as needed
};
};

const toContainExpectedAge = (expectedAge: number) => {
return {
message: () => `Expected person with name ${person.name} to be ${expectedAge} years old.\n\tReceived: ${person.age}`,
pass: person.age === expectedAge,
};
};
});
