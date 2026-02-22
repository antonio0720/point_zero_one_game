class TitleProgression {
private titles: string[] = [
'Novice',
'Apprentice',
'Journeyman',
'Expert',
'Master',
'Grand Master',
'Legendary',
'Epic'
];

private currentTitleIndex: number = 0;

constructor(private achievements: number) {}

getCurrentTitle(): string {
return this.titles[this.currentTitleIndex];
}

earnAchievement(): void {
this.achievements++;

if (this.achievements >= this.titles.length) {
// If all achievements are earned, reset the counter and move to the next highest title
this.currentTitleIndex = (this.currentTitleIndex + 1) % this.titles.length;
this.achievements = this.achievements % this.titles.length;
} else if (this.achievements >= this.currentTitleIndex) {
// Move to the next title when enough achievements are earned
this.currentTitleIndex++;
}
}
}
