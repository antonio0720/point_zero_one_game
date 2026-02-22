class Titles {
private titles: Map<string, Title> = new Map();

addTitle(titleName: string, titleDescription: string, requiredPoints: number) {
const newTitle = new Title(titleName, titleDescription, requiredPoints);
this.titles.set(titleName, newTitle);
}

getTitle(titleName: string): Title | undefined {
return this.titles.get(titleName);
}

hasTitle(titleName: string): boolean {
return this.titles.has(titleName);
}
}

class Title {
private titleName: string;
private titleDescription: string;
private requiredPoints: number;
private earnedPoints: number = 0;

constructor(titleName: string, titleDescription: string, requiredPoints: number) {
this.titleName = titleName;
this.titleDescription = titleDescription;
this.requiredPoints = requiredPoints;
}

earnPoints(points: number): void {
this.earnedPoints += points;

if (this.earnedPoints >= this.requiredPoints) {
console.log(`Congratulations! You've earned the "${this.titleName}" title!`);
this.reset();
}
}

reset(): void {
this.earnedPoints = 0;
}
}
