import * as _ from 'lodash';
import { Card, Deck } from '@deck-builder/cards';
import { BatchOperation, BatchResult, OperationType } from './batch-operations';
import { Logger } from '../../logger';

export class CountCardsOperation extends BatchOperation<Card[]> {
constructor(private countByKey: string, private fallbackValue = 0) {
super();
}

async process(cards: Card[], deck: Deck): Promise<BatchResult> {
const result = new Map<string, number>();
cards.forEach((card) => {
let value = card[this.countByKey];
if (_.isUndefined(value)) value = this.fallbackValue;
result.set(value, (result.get(value) || 0) + 1);
});

return {
type: OperationType.COUNT_CARDS,
data: Array.from(result),
};
}
}

export class RemoveDuplicatesOperation extends BatchOperation<Card[]> {
async process(cards: Card[], deck: Deck): Promise<BatchResult> {
return {
type: OperationType.REMOVE_DUPLICATES,
data: [...new Set(cards)],
};
}
}

export class ShuffleDeckOperation extends BatchOperation<Deck> {
async process(deck: Deck): Promise<BatchResult> {
deck.shuffle();

return {
type: OperationType.SHUFFLE_DECK,
data: deck,
};
}
}
