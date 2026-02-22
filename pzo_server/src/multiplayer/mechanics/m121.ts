// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M121DailyGauntletSameSeedForEveryoneMechanic } from './m121_daily_gauntlet_same_seed_for_everyone_mechanic';

export class M121DailyGauntletSameSeedForEveryoneMultiplayerMechanics {
  public static readonly NAME = 'M121_DAILY_GAUNTLET_SAME_SEED_FOR_EVERYONE';
  public static readonly DESCRIPTION = 'Same seed for everyone in daily gauntlet mode';

  private _mlEnabled: boolean;
  private _seed: number;

  constructor() {
    this._mlEnabled = false;
    this._seed = Math.floor(Math.random() * (2 ** 32));
  }

  get mlEnabled(): boolean {
    return this._mlEnabled;
  }

  set mlEnabled(value: boolean) {
    this._mlEnabled = value;
  }

  get seed(): number {
    return this._seed;
  }

  set seed(value: number) {
    this._seed = value;
  }
}

export class M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImpl extends M121DailyGauntletSameSeedForEveryoneMultiplayerMechanics {
  public static readonly NAME = 'M121_DAILY_GAUNTLET_SAME_SEED_FOR_EVERYONE';
  public static readonly DESCRIPTION = 'Same seed for everyone in daily gauntlet mode';

  private _mlModel: any;

  constructor() {
    super();
    this._mlModel = null;
  }

  get mlModel(): any {
    return this._mlModel;
  }

  set mlModel(value: any) {
    this._mlModel = value;
  }
}

export class M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAudit extends M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImpl {
  public static readonly NAME = 'M121_DAILY_GAUNTLET_SAME_SEED_FOR_EVERYONE';
  public static readonly DESCRIPTION = 'Same seed for everyone in daily gauntlet mode';

  private _auditHash: string;

  constructor() {
    super();
    this._auditHash = '';
  }

  get auditHash(): string {
    return this._auditHash;
  }

  set auditHash(value: string) {
    this._auditHash = value;
  }
}

export class M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAuditOutput extends M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAudit {
  public static readonly NAME = 'M121_DAILY_GAUNTLET_SAME_SEED_FOR_EVERYONE';
  public static readonly DESCRIPTION = 'Same seed for everyone in daily gauntlet mode';

  private _output: number;

  constructor() {
    super();
    this._output = 0;
  }

  get output(): number {
    return this._output;
  }

  set output(value: number) {
    if (value < 0 || value > 1) {
      throw new Error('Output must be between 0 and 1');
    }
    this._output = value;
  }
}

export class M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAuditOutputBounded extends M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAuditOutput {
  public static readonly NAME = 'M121_DAILY_GAUNTLET_SAME_SEED_FOR_EVERYONE';
  public static readonly DESCRIPTION = 'Same seed for everyone in daily gauntlet mode';

  private _boundedOutput: number;

  constructor() {
    super();
    this._boundedOutput = 0;
  }

  get boundedOutput(): number {
    return this._boundedOutput;
  }

  set boundedOutput(value: number) {
    if (value < 0 || value > 1) {
      throw new Error('Bounded output must be between 0 and 1');
    }
    this._boundedOutput = value;
  }
}

export class M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAuditOutputBoundedKillswitch extends M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAuditOutputBounded {
  public static readonly NAME = 'M121_DAILY_GAUNTLET_SAME_SEED_FOR_EVERYONE';
  public static readonly DESCRIPTION = 'Same seed for everyone in daily gauntlet mode';

  private _killswitch: boolean;

  constructor() {
    super();
    this._killswitch = false;
  }

  get killswitch(): boolean {
    return this._killswitch;
  }

  set killswitch(value: boolean) {
    this._killswitch = value;
  }
}

export class M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAuditOutputBoundedKillswitchDeterministic extends M121DailyGauntletSameSeedForEveryoneMultiplayerMechanicsImplAuditOutputBoundedKillswitch {
  public static readonly NAME = 'M121_DAILY_GAUNTLET_SAME_SEED_FOR_EVERYONE';
  public static readonly DESCRIPTION = 'Same seed for everyone in daily gauntlet mode';

  private _deterministic: boolean;

  constructor() {
    super();
    this._deterministic = true;
  }

  get deterministic(): boolean {
    return this._deterministic;
  }

  set deterministic(value: boolean) {
    this._deterministic = value;
  }
}
