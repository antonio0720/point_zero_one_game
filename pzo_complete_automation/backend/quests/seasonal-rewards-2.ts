player.inventory.push(reward.value);
break;
case 'currency':
player.currency += reward.value;
break;
case 'experience':
player.experience += reward.value;
}
}

function completeAchievement(player: Player, achievementId: number) {
const achievement = achievements.find((a) => a.id === achievementId);
if (achievement && achievement.unlockConditions(player)) {
player.achievements.push(achievement.id);
grantReward(player, achievement.reward);
}
}

function completeQuest(player: Player, questId: number) {
const quest = quests.find((q) => q.id === questId);
if (quest && quest.completionCondition(player)) {
player.quests[quest.id].status = 'completed';
grantReward(player, quest.reward);
}
}
```
