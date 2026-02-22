// pzo_engine/src/mechanics/m072.ts

export class M72ActionBudget {
    private readonly _mlEnabled: boolean;
    private readonly _auditHash: string;

    constructor(mlEnabled: boolean, auditHash: string) {
        this._mlEnabled = mlEnabled;
        this._auditHash = auditHash;
    }

    public get mlEnabled(): boolean {
        return this._mlEnabled;
    }

    public get auditHash(): string {
        return this._auditHash;
    }
}

export class M72RateLimitedInputs {
    private readonly _maxInputsPerSecond: number;

    constructor(maxInputsPerSecond: number) {
        this._maxInputsPerSecond = maxInputsPerSecond;
    }

    public get maxInputsPerSecond(): number {
        return this._maxInputsPerSecond;
    }
}

export class M72AntiBotPaceControl {
    private readonly _minTimeBetweenActions: number;

    constructor(minTimeBetweenActions: number) {
        this._minTimeBetweenActions = minTimeBetweenActions;
    }

    public get minTimeBetweenActions(): number {
        return this._minTimeBetweenActions;
    }
}

export class M72ActionBudgetRateLimitedInputsAntiBotPaceControl {
    private readonly _rateLimitedInputs: M72RateLimitedInputs;
    private readonly _antiBotPaceControl: M72AntiBotPaceControl;

    constructor(rateLimitedInputs: M72RateLimitedInputs, antiBotPaceControl: M72AntiBotPaceControl) {
        this._rateLimitedInputs = rateLimitedInputs;
        this._antiBotPaceControl = antiBotPaceControl;
    }

    public get rateLimitedInputs(): M72RateLimitedInputs {
        return this._rateLimitedInputs;
    }

    public get antiBotPaceControl(): M72AntiBotPaceControl {
        return this._antiBotPaceControl;
    }
}

export class M72ActionBudgetController {
    private readonly _actionBudget: M72ActionBudget;
    private readonly _mlModel: MLModel;

    constructor(actionBudget: M72ActionBudget, mlModel: MLModel) {
        this._actionBudget = actionBudget;
        this._mlModel = mlModel;
    }

    public get actionBudget(): M72ActionBudget {
        return this._actionBudget;
    }

    public get mlModel(): MLModel {
        return this._mlModel;
    }
}

export class MLModel {
    private readonly _enabled: boolean;

    constructor(enabled: boolean) {
        this._enabled = enabled;
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public predict(input: number): [number, string] {
        if (!this.enabled) {
            throw new Error("ML model is not enabled");
        }
        const output = Math.min(Math.max(input, 0), 1);
        const auditHash = crypto.createHash('sha256').update(output.toString()).digest('hex');
        return [output, auditHash];
    }
}

export function M72ActionBudgetRateLimitedInputsAntiBotPaceControlFactory(
    mlEnabled: boolean,
    auditHash: string,
    maxInputsPerSecond: number,
    minTimeBetweenActions: number
): M72ActionBudgetRateLimitedInputsAntiBotPaceControl {
    const actionBudget = new M72ActionBudget(mlEnabled, auditHash);
    const rateLimitedInputs = new M72RateLimitedInputs(maxInputsPerSecond);
    const antiBotPaceControl = new M72AntiBotPaceControl(minTimeBetweenActions);
    return new M72ActionBudgetRateLimitedInputsAntiBotPaceControl(rateLimitedInputs, antiBotPaceControl);
}

export function M72ActionBudgetControllerFactory(
    mlModel: MLModel,
    actionBudget: M72ActionBudget
): M72ActionBudgetController {
    return new M72ActionBudgetController(actionBudget, mlModel);
}
