// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

export class M142 {
    private _mlEnabled = false;
    public mlEnabled: boolean;

    constructor() {
        this.mlEnabled = this._mlEnabled;
    }

    get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    set mlEnabled(value: boolean) {
        this._mlEnabled = value;
    }
}

export class M142Config {
    public houseRules: { [key: string]: any };
    public publishedConstraints: { [key: string]: any };

    constructor() {
        this.houseRules = {};
        this.publishedConstraints = {};
    }

    get houseRules(): { [key: string]: any } {
        return this._houseRules;
    }

    set houseRules(value: { [key: string]: any }) {
        this._houseRules = value;
    }

    get publishedConstraints(): { [key: string]: any } {
        return this._publishedConstraints;
    }

    set publishedConstraints(value: { [key: string]: any }) {
        this._publishedConstraints = value;
    }
}

export class M142Game {
    public mlEnabled: boolean;
    public houseRules: { [key: string]: any };
    public publishedConstraints: { [key: string]: any };

    constructor() {
        this.mlEnabled = false;
        this.houseRules = {};
        this.publishedConstraints = {};
    }

    get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    set mlEnabled(value: boolean) {
        this._mlEnabled = value;
    }

    get houseRules(): { [key: string]: any } {
        return this._houseRules;
    }

    set houseRules(value: { [key: string]: any }) {
        this._houseRules = value;
    }

    get publishedConstraints(): { [key: string]: any } {
        return this._publishedConstraints;
    }

    set publishedConstraints(value: { [key: string]: any }) {
        this._publishedConstraints = value;
    }
}

export class M142AuditHash {
    public hash: number;

    constructor() {
        this.hash = 0;
    }

    get hash(): number {
        return this._hash;
    }

    set hash(value: number) {
        if (value < 0 || value > 1) {
            throw new Error('Audit hash must be between 0 and 1');
        }
        this._hash = value;
    }
}

export class M142GameEngine {
    public mlEnabled: boolean;
    public houseRules: { [key: string]: any };
    public publishedConstraints: { [key: string]: any };

    constructor() {
        this.mlEnabled = false;
        this.houseRules = {};
        this.publishedConstraints = {};
    }

    get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    set mlEnabled(value: boolean) {
        this._mlEnabled = value;
    }

    get houseRules(): { [key: string]: any } {
        return this._houseRules;
    }

    set houseRules(value: { [key: string]: any }) {
        this._houseRules = value;
    }

    get publishedConstraints(): { [key: string]: any } {
        return this._publishedConstraints;
    }

    set publishedConstraints(value: { [key: string]: any }) {
        this._publishedConstraints = value;
    }
}
