///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_engine/src/integrity/signed-actions.ts

// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { Action } from '../action';
import { HashFunction } from './hash-function';

export class SignedAction {
  private readonly _key: string;
  private readonly _hashFunction: HashFunction;

  constructor(key: string, hashFunction: HashFunction) {
    this._key = key;
    this._hashFunction = hashFunction;
  }

  public sign(action: Action): string {
    const data = JSON.stringify({
      action,
      auditHash: Math.random().toString(36).substr(2),
      mlEnabled: false, // TODO: implement ML model
    });
    return this._hashFunction.hmacSha256(data, this._key);
  }

  public verify(action: Action, signature: string): boolean {
    const data = JSON.stringify({
      action,
      auditHash: Math.random().toString(36).substr(2),
      mlEnabled: false, // TODO: implement ML model
    });
    return this._hashFunction.verifyHmacSha256(data, signature, this._key);
  }
}

export function createSignedAction(key: string): SignedAction {
  const hashFunction = new HashFunction();
  return new SignedAction(key, hashFunction);
}
