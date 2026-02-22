class Card {
name: string;
description: string;
cost: number;
effect: Function;
constructor(name: string, description: string, cost: number, effect: Function) {
this.name = name;
this.description = description;
this.cost = cost;
this.effect = effect;
}
}
