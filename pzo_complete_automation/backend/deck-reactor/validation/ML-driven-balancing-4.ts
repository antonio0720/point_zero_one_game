import * as ml from 'ml-regression';
import { ICard } from '../interfaces/ICard';

interface IDeck {
cards: ICard[];
}

class MLBalancer {
private k: number;
private trainedModel: ml.KNN;
private features: number[][];
private targets: number[];

constructor(k: number) {
this.k = k;
}

train(deck: IDeck): void {
const inputData = deck.cards.map((card) => [
card.attack,
card.defense,
card.cost,
]);
const outputData = deck.cards.map((card) => card.count);

this.features = inputData;
this.targets = outputData;

this.trainedModel = ml.knnRegressor(this.k);
this.trainedModel.train(this.features, this.targets);
}

predictBalancedCount(card: ICard): number {
const input = [card.attack, card.defense, card.cost];
return this.trainedModel.predict([input])[0];
}
}
