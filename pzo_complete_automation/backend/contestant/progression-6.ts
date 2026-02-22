export class Progression {
private terms: number[];

constructor(initialTerm: number, commonDifference: number) {
this.terms = [initialTerm];
for (let i = 1; i < 6; i++) {
this.terms.push(this.terms[i - 1] + commonDifference);
}
}

public getCurrentTerm(): number {
return this.terms[5];
}

public nextProgression(): void {
for (let i = 6; i < this.terms.length + 1; i++) {
this.terms.push(this.terms[i - 1] + this.terms[5] - this.terms[i - 6]);
}
}
}
