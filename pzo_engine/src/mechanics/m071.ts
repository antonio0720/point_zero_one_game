// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { MlModel } from '../ml/MlModel';
import { GameEngine } from '../GameEngine';

export class DeviceAttestation {
  private mlModel: MlModel;

  constructor(engine: GameEngine) {
    this.mlModel = new MlModel(engine, 'device_attestation');
  }

  public async evaluateDevice(deviceId: string): Promise<number> {
    if (!this.mlEnabled()) {
      return 0;
    }
    const input = { deviceId };
    const output = await this.mlModel.evaluate(input);
    if (output === null) {
      throw new Error('Failed to evaluate device attestation');
    }
    return Math.min(Math.max(output, 0), 1);
  }

  public async auditHash(deviceId: string): Promise<string> {
    const input = { deviceId };
    const output = await this.mlModel.evaluate(input);
    if (output === null) {
      throw new Error('Failed to evaluate device attestation');
    }
    return this.mlModel.auditHash(output);
  }

  private mlEnabled(): boolean {
    // Implement logic for kill-switch here
    return true;
  }
}

export function getDeviceAttestation(engine: GameEngine): DeviceAttestation {
  return new DeviceAttestation(engine);
}
