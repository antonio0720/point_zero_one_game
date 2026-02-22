unlocked = player.relics.size > 0;
break;
case 'fiftyPoints':
unlocked = player.points >= 50;
break;
case 'tenRelics':
unlocked = player.relics.size >= 10;
break;
// Add more achievement checks as needed
}

if (unlocked && !player.achievements.has(achievement)) {
player.achievements.add(achievement);
}
}
}

const initialPlayer: Player = {
id: 1,
relics: new Set<number>(),
achievements: new Set<string>()
};

playerProgress(initialPlayer); // Initialize progression for the player
```
