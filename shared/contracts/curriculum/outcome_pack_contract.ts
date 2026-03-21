/**
 * OutcomePack Contract
 */

declare module '@pointzeroonegame/shared' {
  namespace contracts.curriculum {
    export interface IOutcomePack {
      pack_id: string;
      scenarios: Array<string>;
      objectives: Array<string>;
      version: number;
      locales: Record<string, any>; // Assuming locales is an object with dynamic keys
    }

    export type OutcomePack = IOutcomePack & { readonly __type: unique symbol };
  }
}
