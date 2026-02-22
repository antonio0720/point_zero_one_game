import { Ability, Simulator } from '@main/simulator';
import { Champion } from '@main/champion';

class SynergyOverload12Ability extends Ability {
constructor(name: string, champion: Champion) {
super(name, champion);

this.cooldown = 90;
this.cost = 100;

this.onCast = (targets) => {
const targetsWithSynergyBuff = targets.filter((target) => target.hasBuff('synergy-buff'));

for (let i = 0; i < targetsWithSynergyBuff.length && targetsWithSynergyBuff[i].healthPercentage > 30; ++i) {
const target = targetsWithSynergyBuff[i];

target.applyBuff('synergy-overload', this, {
duration: 5,
stackCount: 2,
});
}
};

this.onTick = (deltaTime: number) => {
const targetsWithSynergyOverload = this.champion.getAllies().filter((ally) => ally.hasBuff('synergy-overload'));

for (let i = 0; i < targetsWithSynergyOverload.length; ++i) {
const target = targetsWithSynergyOverload[i];

if (!target.isDead && !target.isSilenced && target.hasBuff('synergy-overload').stackCount > 0) {
let damage = this.powerScaler * 5;

target.takeDamage(damage, this);
target.removeBuff('synergy-overload');
}
}
};
}
}

export { SynergyOverload12Ability };
