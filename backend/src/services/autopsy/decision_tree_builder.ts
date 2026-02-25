/**
 * DecisionTreeBuilder — builds a choice-weighted decision tree from run event logs.
 * backend/src/services/autopsy/decision_tree_builder.ts
 *
 * Sovereign implementation:
 *   - computeOutcomeDeltas(): weights each fork by Δ(outcome) vs counterfactual siblings
 *   - identifyDecisiveFork(): walks the tree, marks the fork with highest outcome divergence
 *   - All logic is pure/deterministic — no IO, no side effects, safe for replay engine
 */

// ── Core domain types ─────────────────────────────────────────────────────────

/**
 * Represents the financial state of a run at a given point in time.
 * Outcome is the final_net_worth proxy captured at each turn.
 */
export class RunState {
  constructor(
    public readonly outcome:    number,   // net_worth or score at this turn
    public readonly cashFlow:   number = 0,  // income - expenses at this turn
    public readonly turnIndex:  number = 0,
  ) {}
}

/**
 * A single event in the run log: a choice was made at choiceTurn
 * producing runState at that point.
 */
export class RunEventLog {
  constructor(
    private readonly events: ReadonlyArray<{
      choiceTurn: number;
      runState:   RunState;
    }>,
  ) {}

  [Symbol.iterator](): IterableIterator<{ choiceTurn: number; runState: RunState }> {
    return (this.events as Array<{ choiceTurn: number; runState: RunState }>)[Symbol.iterator]();
  }

  get length(): number {
    return this.events.length;
  }
}

// ── Tree nodes ────────────────────────────────────────────────────────────────

/**
 * Abstract base node.
 * A tree is a forest of DecisionTreeForkNodes under a root RootNode.
 */
export abstract class DecisionTreeNode {
  protected children: DecisionTreeForkNode[] = [];

  /** The outcome delta computed from children (set during computeOutcomeDeltas pass). */
  public outcomeDelta: number = 0;

  /** Whether this node was identified as the decisive turning point. */
  public isDecisiveFork: boolean = false;

  public addChild(child: DecisionTreeForkNode): void {
    this.children.push(child);
  }

  /**
   * Finds an existing fork node for the given choiceTurn among direct children.
   */
  public getFork(choiceTurn: number): DecisionTreeForkNode | null {
    return this.children.find(n => n.choiceTurn === choiceTurn) ?? null;
  }

  public abstract updateRunState(runState: RunState): void;

  /** Returns all fork nodes in DFS order (self first, then children). */
  public allForks(): DecisionTreeForkNode[] {
    const result: DecisionTreeForkNode[] = [];
    for (const child of this.children) {
      result.push(child, ...child.allForks());
    }
    return result;
  }
}

/**
 * Root sentinel node — holds the top-level forks and provides the
 * entry points for computeOutcomeDeltas() and identifyDecisiveFork().
 */
export class RootNode extends DecisionTreeNode {
  public updateRunState(_runState: RunState): void {
    // Root has no own state; it is the container.
  }

  /**
   * Post-order DFS: compute outcome deltas bottom-up so each parent can
   * aggregate its children's divergence.
   *
   * Delta at a fork = |outcome_at_fork - mean(children outcomes)|
   * For leaf forks (no children), delta = outcome itself (relative to siblings).
   */
  public computeOutcomeDeltas(): void {
    this.computeSubtreeDeltas(this.children);
  }

  private computeSubtreeDeltas(forks: DecisionTreeForkNode[]): void {
    if (!forks.length) return;

    // Recurse depth-first
    for (const fork of forks) {
      this.computeSubtreeDeltas(fork.children);
    }

    // Compute sibling-relative deltas at this level
    const outcomes = forks.map(f => f.runState.outcome);
    const mean     = outcomes.reduce((s, v) => s + v, 0) / outcomes.length;

    for (const fork of forks) {
      const childMean = fork.children.length
        ? fork.children.reduce((s, c) => s + c.runState.outcome, 0) / fork.children.length
        : fork.runState.outcome;

      // Delta = deviation from sibling mean, amplified by child divergence
      fork.outcomeDelta = Math.abs(fork.runState.outcome - mean)
        + (fork.children.length
            ? Math.abs(fork.runState.outcome - childMean)
            : 0);
    }
  }

  /**
   * Identifies the single fork with the highest outcomeDelta across the
   * entire tree and marks it as isDecisiveFork = true.
   *
   * Tie-breaking: earlier choiceTurn wins (first decisive moment).
   */
  public identifyDecisiveFork(): void {
    const all = this.allForks();
    if (!all.length) return;

    // Reset any prior markings
    all.forEach(f => { f.isDecisiveFork = false; });

    // Find max delta with earliest-turn tie-break
    let decisive = all[0];
    for (const fork of all) {
      if (
        fork.outcomeDelta > decisive.outcomeDelta ||
        (fork.outcomeDelta === decisive.outcomeDelta &&
         fork.choiceTurn  < decisive.choiceTurn)
      ) {
        decisive = fork;
      }
    }

    decisive.isDecisiveFork = true;
  }

  /** Returns the decisive fork, or null if tree is empty / not yet analysed. */
  public getDecisiveFork(): DecisionTreeForkNode | null {
    return this.allForks().find(f => f.isDecisiveFork) ?? null;
  }
}

/**
 * Represents a choice made at a specific turn.
 * Stores the run state snapshot at the moment of the choice.
 */
export class DecisionTreeForkNode extends DecisionTreeNode {
  constructor(
    public readonly choiceTurn: number,
    private _runState: RunState,
  ) {
    super();
  }

  get runState(): RunState {
    return this._runState;
  }

  public updateRunState(runState: RunState): void {
    this._runState = runState;
  }

  /**
   * computeOutcomeDeltas and identifyDecisiveFork are only called from the root.
   * These are no-ops on fork nodes to satisfy the abstract contract.
   */
  public computeOutcomeDeltas(): void {
    // Delegated to RootNode.computeSubtreeDeltas
  }

  public identifyDecisiveFork(): void {
    // Delegated to RootNode.identifyDecisiveFork
  }

  /** Serializable summary for API responses. */
  public toSummary(): DecisionForkSummary {
    return {
      choiceTurn:    this.choiceTurn,
      outcome:       this._runState.outcome,
      cashFlow:      this._runState.cashFlow,
      outcomeDelta:  this.outcomeDelta,
      isDecisive:    this.isDecisiveFork,
      childCount:    this.children.length,
    };
  }
}

export interface DecisionForkSummary {
  choiceTurn:   number;
  outcome:      number;
  cashFlow:     number;
  outcomeDelta: number;
  isDecisive:   boolean;
  childCount:   number;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export class DecisionTreeBuilder {
  /**
   * Builds a fully-analysed decision tree from a run's event log.
   *
   * Algorithm:
   *   1. Walk events in order, building a path of fork nodes
   *   2. Re-use existing fork if same choiceTurn already branched
   *   3. After tree construction, run computeOutcomeDeltas (bottom-up)
   *   4. Run identifyDecisiveFork (single pass for max delta)
   *
   * Returns the root node; call root.getDecisiveFork() for the turning point.
   */
  public build(eventLog: RunEventLog): RootNode {
    const root: RootNode         = new RootNode();
    let   currentNode: DecisionTreeNode = root;

    for (const event of eventLog) {
      const { choiceTurn, runState } = event;

      // Find or create fork for this choice turn under the current node
      let fork = currentNode.getFork(choiceTurn);
      if (!fork) {
        fork = new DecisionTreeForkNode(choiceTurn, runState);
        currentNode.addChild(fork);
      } else {
        // Update state — later events for the same turn win
        fork.updateRunState(runState);
      }

      currentNode = fork;
    }

    // Analysis passes
    root.computeOutcomeDeltas();
    root.identifyDecisiveFork();

    return root;
  }

  /**
   * Convenience: builds tree and immediately returns the decisive fork summary.
   * Returns null for empty logs.
   */
  public findDecisiveFork(eventLog: RunEventLog): DecisionForkSummary | null {
    if (eventLog.length === 0) return null;
    const root    = this.build(eventLog);
    const decisive = root.getDecisiveFork();
    return decisive ? decisive.toSummary() : null;
  }

  /**
   * Returns all fork summaries sorted by outcomeDelta descending.
   * Useful for the autopsy "top N pivotal moments" UI.
   */
  public rankForks(eventLog: RunEventLog, topN = 5): DecisionForkSummary[] {
    if (eventLog.length === 0) return [];
    const root  = this.build(eventLog);
    const forks = root.allForks();
    return forks
      .map(f => f.toSummary())
      .sort((a, b) => b.outcomeDelta - a.outcomeDelta)
      .slice(0, topN);
  }
}
