type Quest = {
id: string;
name: string;
startTime: Date;
endTime: Date;
};

const quests: Quest[] = [
{
id: 'quest1',
name: 'Quest 1',
startTime: new Date('2022-01-01T00:00:00Z'),
endTime: new Date('2022-01-05T23:59:59Z'),
},
{
id: 'quest2',
name: 'Quest 2',
startTime: new Date('2022-01-02T00:00:00Z'),
endTime: new Date('2022-01-07T23:59:59Z'),
},
// Add more quests as needed...
];

function isQuestAvailable(questId: string): boolean {
const currentDate = new Date();
const quest = quests.find((q) => q.id === questId);

if (!quest) return false;

return (
currentDate >= quest.startTime && currentDate <= quest.endTime
);
}
