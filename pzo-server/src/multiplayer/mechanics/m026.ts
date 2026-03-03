// tslint:disable:no-any strict-type-checking no-object-literal-types

import { MlModel } from '../ml_model';
import { Player } from '../../player';
import { Contract } from './contract';

export class CoopContract {
  private _players: Player[];
  private _contract: Contract;
  private _mlEnabled = false;

  constructor(players: Player[], contract: Contract) {
    this._players = players;
    this._contract = contract;
  }

  get players(): Player[] {
    return this._players;
  }

  get contract(): Contract {
    return this._contract;
  }

  set mlEnabled(value: boolean) {
    this._mlEnabled = value;
  }

  get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  get auditHash(): string {
    const playersStringified = JSON.stringify(this.players);
    const contractStringified = JSON.stringify(this.contract);
    return crypto.createHash('sha256').update(playersStringified + contractStringified).digest('hex');
  }

  isBindingValid(binding: { [key: number]: Player }): boolean {
    if (Object.keys(binding).length !== this._players.length) {
      return false;
    }
    for (const player of this._players) {
      if (!(player.id in binding)) {
        return false;
      }
      const boundPlayer = binding[player.id];
      if (!boundPlayer || boundPlayer.id !== player.id) {
        return false;
      }
    }
    return true;
  }

  getBinding(): { [key: number]: Player } | null {
    if (this._mlEnabled && this.players.length > 1) {
      const mlModel = new MlModel();
      const binding = mlModel.getCoopContractBinding(this.players);
      if (binding) {
        return binding;
      }
    }
    for (const player of this.players) {
      const binding: { [key: number]: Player } = {};
      let index = 0;
      for (const otherPlayer of this.players) {
        if (otherPlayer.id !== player.id) {
          binding[index++] = otherPlayer;
        }
      }
      if (this.isBindingValid(binding)) {
        return binding;
      }
    }
    return null;
  }

  getOutput(): number[] | null {
    const binding = this.getBinding();
    if (!binding) {
      return null;
    }
    const output: number[] = [];
    for (const player of this.players) {
      output.push(binding[player.id].id);
    }
    return output.map((value, index) => Math.round(value / 100));
  }

  getDeterministicOutput(): number[] | null {
    const binding = this.getBinding();
    if (!binding) {
      return null;
    }
    const output: number[] = [];
    for (const player of this.players) {
      output.push(binding[player.id].id);
    }
    return output.map((value, index) => Math.floor(value / 100));
  }
}
