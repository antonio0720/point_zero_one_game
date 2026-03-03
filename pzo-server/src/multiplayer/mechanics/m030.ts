// tslint:disable:no-any strict-type-checking no-object-literal-types
// tslint:enable:no-any strict-type-checking no-object-literal-types

import { M30Mechanics } from './m030_mechanics';
import { M30Drama } from './m030_drama';

export class M30DefaultAndBetrayalControlledDrama extends M30Mechanics {
  private drama: M30Drama;

  constructor() {
    super();
    this.drama = new M30Drama();
  }

  public getDrama(): M30Drama {
    return this.drama;
  }
}

export class M30DefaultAndBetrayalControlledDramaConfig extends M30Mechanics.Config {
  public mlEnabled: boolean;
  public auditHash: string;

  constructor() {
    super();
    this.mlEnabled = false;
    this.auditHash = '';
  }

  public getBoundedOutput(): number {
    return Math.floor(Math.random() * (1 - 0 + 1));
  }
}

export class M30DefaultAndBetrayalControlledDramaMechanics extends M30Mechanics.Mechanics {
  private drama: M30Drama;

  constructor() {
    super();
    this.drama = new M30Drama();
  }

  public getDrama(): M30Drama {
    return this.drama;
  }
}

export class M30DefaultAndBetrayalControlledDramaDrama extends M30Mechanics.Drama {
  private drama: M30Drama;

  constructor() {
    super();
    this.drama = new M30Drama();
  }

  public getDrama(): M30Drama {
    return this.drama;
  }
}

export class M30DefaultAndBetrayalControlledDramaMechanicsConfig extends M30Mechanics.Mechanics.Config {
  public mlEnabled: boolean;
  public auditHash: string;

  constructor() {
    super();
    this.mlEnabled = false;
    this.auditHash = '';
  }

  public getBoundedOutput(): number {
    return Math.floor(Math.random() * (1 - 0 + 1));
  }
}
