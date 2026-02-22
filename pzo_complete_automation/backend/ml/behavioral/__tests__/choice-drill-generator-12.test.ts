import { ChoiceDrillGenerator } from "../../choice-drill-generator";
import { DrillChoice } from "../../drill-choice";
import { QuestionBank } from "../../question-bank";
import { Topic } from "../../topic";
import { expect } from "chai";
import "mocha";

describe("ChoiceDrillGenerator", () => {
let questionBank: QuestionBank;

beforeEach(() => {
questionBank = new QuestionBank();
questionBank.addTopic(new Topic("Math", ["Addition", "Subtraction"]));

const additionQuestions = [
{ id: "q1", prompt: "What is 2 + 3?", answer: "5" },
{ id: "q2", prompt: "What is 4 + 6?", answer: "10" },
{ id: "q3", prompt: "What is 7 + 8?", answer: "15" },
];

const subtractionQuestions = [
{ id: "q4", prompt: "What is 9 - 2?", answer: "7" },
{ id: "q5", prompt: "What is 10 - 5?", answer: "5" },
{ id: "q6", prompt: "What is 12 - 8?", answer: "4" },
];

additionQuestions.forEach((question) => questionBank.addQuestion(question));
subtractionQuestions.forEach((question) => questionBank.addQuestion(question));
});

it("generates a choice drill with the correct number of questions", () => {
const generator = new ChoiceDrillGenerator();
const drill = generator.generate(questionBank, "Math", 3);

expect(drill).to.be.an.instanceOf(DrillChoice);
expect(drill.questions.length).to.equal(3);
});

it("generates a choice drill with questions from the specified topic", () => {
const generator = new ChoiceDrillGenerator();
const drill = generator.generate(questionBank, "Math");

drill.questions.forEach((question) => {
expect(questionBank.getTopicById(question.topicId).name).to.equal("Math");
});
});

it("generates a choice drill with a mix of question types", () => {
const generator = new ChoiceDrillGenerator();
const drill = generator.generate(questionBank, "Math", 5);

let additionCount = 0;
let subtractionCount = 0;

drill.questions.forEach((question) => {
if (question.prompt.includes("Addition")) {
additionCount++;
} else if (question.prompt.includes("Subtraction")) {
subtractionCount++;
}
});

expect(drill.questions.length).to.equal(5);
expect(additionCount).to.be.above(2);
expect(subtractionCount).to.be.above(2);
});
});
