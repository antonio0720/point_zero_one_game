interface Achievement {
id: string;
title: string;
description: string;
}

interface Progress {
achievementsUnlocked: Set<string>;
currentTitle: string | null;
}

class Title3 {
private _progress: Progress;

constructor(initialProgress: Partial<Progress>) {
this._progress = {
...{ achievementsUnlocked: new Set() },
...initialProgress,
};
}

unlockAchievement(achievementId: string): void {
if (!this._progress.achievementsUnlocked.has(achievementId)) {
this._progress.achievementsUnlocked.add(achievementId);

// Check if all required achievements for a new title have been unlocked
if (this._progress.achievementsUnlocked.size === TITLE_3_REQUIRED_ACHIEVEMENTS.length) {
this._promoteToTitle(Title4);
}
}
}

get currentTitle(): string | null {
return this._progress.currentTitle;
}

private _promoteToTitle(newTitleConstructor: typeof Title4): void {
const newTitle = new newTitleConstructor({
achievementsUnlocked: new Set(this._progress.achievementsUnlocked),
currentTitle: this._progress.currentTitle,
});

// Update player data with the new title
this._updatePlayerData(newTitle);

// Reset current title to null for this title system instance
this._progress.currentTitle = null;
}

private _updatePlayerData(title: Title3 | Title4): void {
// Update player data with the new title, e.g., save to database or show in UI
console.log(`Updated player data: ${JSON.stringify(title)}`);
}
}

const TITLE_3_REQUIRED_ACHIEVEMENTS = [
'achievement1',
'achievement2',
'achievement3',
];

const title3 = new Title3({ currentTitle: 'Novice' });
