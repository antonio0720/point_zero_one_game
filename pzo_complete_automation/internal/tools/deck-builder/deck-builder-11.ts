import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface Deck {
id: string;
question: string;
answers: Answer[];
}

interface Answer {
text: string;
correct: boolean;
}

function readDecks(filename: string): Deck[] {
const content = fs.readFileSync(filename, 'utf8');
return yaml.loadAll(content) as Deck[];
}

function writeDecks(decks: Deck[], filename: string) {
const output = yaml.dump(decks);
fs.writeFileSync(filename, output);
}

function shuffle<T>(array: T[]): T[] {
for (let i = array.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[array[i], array[j]] = [array[j], array[i]];
}
return array;
}

function getRandomDeck(decks: Deck[]): Deck {
const randomIndex = Math.floor(Math.random() * decks.length);
return decks[randomIndex];
}

function playQuiz(deck: Deck) {
console.log(deck.question);
const answers = deck.answers;
shuffle(answers);

for (let i = 0; i < answers.length; i++) {
let answerText = `${i + 1}. ${answers[i].text}`;
console.log(answerText);
}

const userAnswerIndex = Number(prompt('Which is the correct answer?')) - 1;
if (userAnswerIndex === answers.findIndex((a) => a.correct)) {
console.log('Correct!');
} else {
console.log(`Incorrect! The correct answer was ${answers[answers.findIndex((a) => a.correct)].text}`);
}
}

function main() {
const decksPath = path.join(__dirname, 'decks.yaml');
const decks = readDecks(decksPath);
writeDecks(shuffle(decks), decksPath);

console.log('Shuffled the decks.');

const randomDeck = getRandomDeck(decks);
playQuiz(randomDeck);
}

main();
