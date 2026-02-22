import { Achievement, BattlePass, Quest } from "../../../domain";
import { InMemoryAchievementRepository } from "../../repositories/in-memory/InMemoryAchievementRepository";
import { InMemoryQuestRepository } from "../../repositories/in-memory/InMemoryQuestRepository";
import { InMemoryBattlePassRepository } from "../../repositories/in-memory/InMemoryBattlePassRepository";
import { BattlePassService } from "../services/BattlePassService";

describe("Battle Pass - Battle Pass 10", () => {
let achievementRepository: InMemoryAchievementRepository;
let questRepository: InMemoryQuestRepository;
let battlePassRepository: InMemoryBattlePassRepository;
let battlePassService: BattlePassService;

beforeEach(() => {
achievementRepository = new InMemoryAchievementRepository();
questRepository = new InMemoryQuestRepository();
battlePassRepository = new InMemoryBattlePassRepository();
battlePassService = new BattlePassService(
achievementRepository,
questRepository,
battlePassRepository
);
});

it("should unlock achievements when completing quests", () => {
const achievement1 = new Achievement("Achievement 1");
const achievement2 = new Achievement("Achievement 2");

achievementRepository.create(achievement1);
achievementRepository.create(achievement2);

const quest1 = new Quest(1, "Complete 5 battles", [achievement1]);
const quest2 = new Quest(2, "Deal 100 damage with a sniper rifle", [achievement2]);

questRepository.create(quest1);
questRepository.create(quest2);

battlePassRepository.createBattlePass(10, [quest1, quest2]);

const battlePass = battlePassRepository.getBattlePass(10);

battlePassService.completeQuest(battlePass, 1, { battlesCompleted: 6 });
expect(achievementRepository.getById(achievement1.id).isUnlocked).toBe(true);

battlePassService.completeQuest(battlePass, 2, { sniperRifleDamage: 105 });
expect(achievementRepository.getById(achievement2.id).isUnlocked).toBe(true);
});

it("should update battle pass progress", () => {
const quest1 = new Quest(1, "Complete 5 battles", []);
const quest2 = new Quest(2, "Deal 100 damage with a sniper rifle", []);

questRepository.create(quest1);
questRepository.create(quest2);

battlePassRepository.createBattlePass(10, [quest1, quest2]);

const battlePass = battlePassRepository.getBattlePass(10);

battlePassService.updateProgress(battlePass, { battlesCompleted: 4 });
expect(battlePass.progress).toEqual({ quest1: 4, quest2: 0 });

battlePassService.updateProgress(battlePass, { sniperRifleDamage: 95 });
expect(battlePass.progress).toEqual({ quest1: 4, quest2: 5 });
});

it("should check if battle pass is completed", () => {
const quest1 = new Quest(1, "Complete 5 battles", []);
const quest2 = new Quest(2, "Deal 100 damage with a sniper rifle", []);

questRepository.create(quest1);
questRepository.create(quest2);

battlePassRepository.createBattlePass(10, [quest1, quest2]);

const battlePass = battlePassRepository.getBattlePass(10);

battlePassService.updateProgress(battlePass, { battlesCompleted: 6 });
battlePassService.updateProgress(battlePass, { sniperRifleDamage: 105 });

expect(battlePassService.isBattlePassCompleted(battlePass)).toBe(true);
});
});
