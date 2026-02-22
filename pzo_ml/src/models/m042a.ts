// tslint:disable:no-any strict-type-checking
import { M42aConfig } from './m042a_config';
import { BoundedNudge } from '../utils/bounded_nudge';

export class M42a {
  private readonly config: M42aConfig;
  private readonly nudge: BoundedNudge;

  constructor(config: M42aConfig) {
    this.config = config;
    this.nudge = new BoundedNudge(0, 1);
  }

  public getPromptMinimalismController(): { [key: string]: number } {
    const output = {};

    if (this.config.ml_enabled) {
      // TODO: implement M42a logic here
      // For now, just return a default value
      output['prompt_minimalism_controller'] = this.nudge.getNudge();
    }

    return output;
  }
}

export function getM42a(config: M42aConfig): M42a {
  return new M42a(config);
}
