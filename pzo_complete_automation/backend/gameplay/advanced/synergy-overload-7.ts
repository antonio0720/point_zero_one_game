const fireSynergy1 = new FireSynergy(1, "Fire I", "Increases fire resistance and attack power.");
const fireSynergy2 = new FireSynergy(2, "Fire II", "Further increases fire resistance and attack power.");
// Create other synergies as needed.

const myUnit = new Unit([fireSynergy1, fireSynergy2]);
myUnit.applySynergies();
