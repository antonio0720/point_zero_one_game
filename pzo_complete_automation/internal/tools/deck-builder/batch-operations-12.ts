import * as fs from 'fs';
import { DeckBuilder } from '../src/deckBuilder';
import { CardSet } from '../src/cardSet';
import { Card, CardId } from '../src/card';
import { Operation, OperationType, TranslationOperation } from './operation';

const SET_ID = 'set123';
const DECKS_DIR = './decks';
const DECK_FILE_PATTERN = `${DECKS_DIR}/[a-z0-9_-]+.json`;
const OPERATIONS_DIR = './operations';
const TRANSLATION_OPERATIONS_FILE = `${OPERATIONS_DIR}/translationOperations12.json`;

function readDecks() {
const decks: CardSet[] = [];
fs.readdirSync(DECKS_DIR)
.filter(file => fs.statSync(`${DECKS_DIR}/${file}`).isFile())
.forEach(file => {
const deckJsonContent = fs.readFileSync(`${DECKS_DIR}/${file}`, 'utf8');
decks.push(JSON.parse(deckJsonContent) as CardSet);
});
return decks;
}

function readTranslationOperations() {
const rawOps = JSON.parse(fs.readFileSync(TRANSLATION_OPERATIONS_FILE, 'utf8'));
return rawOps.map((rawOp: any) => new TranslationOperation(rawOp));
}

async function buildDecks() {
const decks = readDecks();
const operations = readTranslationOperations();
const builder = new DeckBuilder(SET_ID);

for (const deck of decks) {
await builder.build(deck, operations);
}
}

buildDecks().catch(console.error);
