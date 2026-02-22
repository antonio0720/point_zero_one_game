import { Event, Log } from "ethers/utils";

export const IDSEight = new Event(
"IDsEight",
(id: number[], indexed: boolean[]) => ({
id1: new Array<number>(8),
id2: new Array<number>(8),
id3: new Array<number>(8),
id4: new Array<number>(8),
id5: new Array<number>(8),
id6: new Array<number>(8),
id7: new Array<number>(8),
id8: new Array<number>(8)
})
);

export function ids EightEvent(log: Log): IDSEightEventMemory {
return {
id1: log.args[0].map((e, i) => i < 8 ? e : undefined),
id2: log.args[1].map((e, i) => i < 8 ? e : undefined),
id3: log.args[2].map((e, i) => i < 8 ? e : undefined),
id4: log.args[3].map((e, i) => i < 8 ? e : undefined),
id5: log.args[4].map((e, i) => i < 8 ? e : undefined),
id6: log.args[5].map((e, i) => i < 8 ? e : undefined),
id7: log.args[6].map((e, i) => i < 8 ? e : undefined),
id8: log.args[7].map((e, i) => i < 8 ? e : undefined)
};
}
