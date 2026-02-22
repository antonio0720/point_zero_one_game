import { ChoiceDrillGenerator } from "../../choice-drill-generator";
import { QuestionBankService } from "../../question-bank.service";
import { QuestionBankItem } from "../../question-bank-item";
import { of } from "rxjs";
import { mockQuestionBank } from "../mocks/mock-question-bank";

describe('ChoiceDrillGenerator', () => {
let questionBankService: QuestionBankService;
let choiceDrillGenerator: ChoiceDrillGenerator;

beforeEach(() => {
questionBankService = jasmine.createSpyObj(['getQuestions']);
choiceDrillGenerator = new ChoiceDrillGenerator(questionBankService);
});

it('should generate a valid choice drill with correct number of questions', () => {
const mockQuestions = Array.from({ length: 10 }, (_, i) => ({
id: `Q${i + 1}`,
questionText: `Question ${i + 1}`,
answers: [
{ text: 'Answer A', isCorrect: false },
{ text: 'Answer B', isCorrect: false },
{ text: 'Answer C', isCorrect: false },
{ text: 'Answer D', isCorrect: true }
].sort(() => 0.5 - Math.random()),
difficultyLevel: i % 3 + 1
}));

questionBankService.getQuestions.and.returnValue(of(mockQuestions));

const choiceDrill = choiceDrillGenerator.generateChoiceDrill('difficultyLevel', 5);

expect(choiceDrill).toEqual(jasmine.arrayContaining(mockQuestions.slice(0, 5)));
});

it('should return an empty array when no questions are available for the given difficulty level', () => {
const mockQuestions = [...mockQuestionBank];
mockQuestions[1].questions = [];

questionBankService.getQuestions.and.returnValue(of(mockQuestions));

const choiceDrill = choiceDrillGenerator.generateChoiceDrill('difficultyLevel2', 5);

expect(choiceDrill).toEqual([]);
});

it('should generate a random order for the questions in the choice drill', () => {
const mockQuestions = Array.from({ length: 10 }, (_, i) => ({
id: `Q${i + 1}`,
questionText: `Question ${i + 1}`,
answers: [
{ text: 'Answer A', isCorrect: false },
{ text: 'Answer B', isCorrect: false },
{ text: 'Answer C', isCorrect: false },
{ text: 'Answer D', isCorrect: true }
].sort(() => 0.5 - Math.random()),
difficultyLevel: i % 3 + 1
}));

questionBankService.getQuestions.and.returnValue(of(mockQuestions));

const choiceDrill = choiceDrillGenerator.generateChoiceDrill('difficultyLevel', 5);
const expectedOrder = [...mockQuestions].sort(() => 0.5 - Math.random()).slice(0, 5).map((q) => q.id);

expect(choiceDrill).toEqual(jasmine.arrayWithProperties(expectedOrder));
});
});
