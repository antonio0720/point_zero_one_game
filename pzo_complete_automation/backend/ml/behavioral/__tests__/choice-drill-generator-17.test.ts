import { ChoiceDrillGenerator } from "../../../ml/behavioral/choice-drill-generator";
import { QuestionSet } from "../../../data/question-set";
import { IQuestion } from "../../../data/i-question";
import { Topic } from "../../../data/topic";
import { TopicsRepository } from "../../../repositories/topics.repository";
import { QuestionRepository } from "../../../repositories/questions.repository";
import { StubTopicsRepository } from "../stubs/topics.repository.stub";
import { StubQuestionsRepository } from "../stubs/questions.repository.stub";

describe('ChoiceDrillGenerator', () => {
const topicsRepository = new TopicsRepository();
const questionsRepository = new QuestionRepository();

beforeAll(async () => {
jest.spyOn(TopicsRepository.prototype, 'getAll').mockImplementation(() => Promise.resolve([
{ id: 1, name: 'Topic 1' },
{ id: 2, name: 'Topic 2' }
]));

jest.spyOn(QuestionRepository.prototype, 'getAllByTopicId').mockImplementation((topicId: number) =>
Promise.resolve([
{ id: 1, text: 'Question 1', topicId, choices: ['Option 1', 'Option 2', 'Option 3'], correctAnswer: 'Option 1' } as IQuestion,
{ id: 2, text: 'Question 2', topicId, choices: ['Option A', 'Option B', 'Option C'], correctAnswer: 'Option B' } as IQuestion,
])
);

const stubTopicsRepository = new StubTopicsRepository();
const stubQuestionsRepository = new StubQuestionsRepository();

topicsRepository.save = stubTopicsRepository.save;
questionsRepository.save = stubQuestionsRepository.save;
});

it('should generate a question set with correct drill type', () => {
const generator = new ChoiceDrillGenerator(topicsRepository, questionsRepository);
const questionSet: QuestionSet = generator.generate({ topicIds: [1, 2], drillType: 'choice' });

expect(questionSet).toHaveLength(3);
expect(questionSet[0].question.id).toEqual(1);
expect(questionSet[1].question.id).not.toEqual(1);
expect(questionSet[2].question.id).not.toEqual(1);
});
});
