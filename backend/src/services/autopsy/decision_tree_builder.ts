Here is the TypeScript file `backend/src/services/autopsy/decision_tree_builder.ts` as per your specifications:

```typescript
/**
 * DecisionTreeBuilder class for building a decision tree from run event logs.
 */
export class DecisionTreeBuilder {
  /**
   * Builds a decision tree from the given run event log.
   * @param eventLog - The run event log to build the decision tree from.
   * @returns The root node of the built decision tree.
   */
  public build(eventLog: RunEventLog): DecisionTreeNode {
    const root = new DecisionTreeNode();
    let currentNode = root;

    eventLog.forEach((event) => {
      const choiceTurn = event.choiceTurn;
      const runState = event.runState;

      // Find the existing fork node for the choice turn or create a new one if not found.
      const forkNode = currentNode.getFork(choiceTurn);
      if (!forkNode) {
        forkNode = new DecisionTreeForkNode(choiceTurn, runState);
        currentNode.addChild(forkNode);
      }

      // Update the run state at the fork node.
      forkNode.updateRunState(runState);

      // Move to the next decision point (the child of the current fork node).
      currentNode = forkNode;
    });

    // Compute outcome delta for each choice and set the decisive fork with the highest divergence.
    root.computeOutcomeDeltas();
    root.identifyDecisiveFork();

    return root;
  }
}

/**
 * Represents a node in the decision tree.
 */
export abstract class DecisionTreeNode {
  protected children: DecisionTreeNode[] = [];

  /**
   * Adds a child node to this node.
   * @param child - The child node to add.
   */
  public addChild(child: DecisionTreeNode): void {
    this.children.push(child);
  }

  /**
   * Gets the child node for the given choice turn or null if not found.
   * @param choiceTurn - The choice turn to find the child node for.
   * @returns The child node for the given choice turn or null if not found.
   */
  public getFork(choiceTurn: number): DecisionTreeNode | null {
    return this.children.find((node) => node instanceof DecisionTreeForkNode && node.choiceTurn === choiceTurn);
  }

  /**
   * Updates the run state at this node with the given run state.
   * @param runState - The new run state to update with.
   */
  public abstract updateRunState(runState: RunState): void;
}

/**
 * Represents a fork node in the decision tree, which stores the run state and choice turn.
 */
export class DecisionTreeForkNode extends DecisionTreeNode {
  constructor(private readonly choiceTurn: number, public readonly runState: RunState) {
    super();
  }

  /**
   * Updates the run state at this node with the given run state.
   * @param runState - The new run state to update with.
   */
  public updateRunState(runState: RunState): void {
    this.runState = runState;
  }

  /**
   * Computes the outcome delta for each choice at this fork node.
   */
  public computeOutcomeDeltas(): void {
    // TODO: Implement computation of outcome deltas.
  }

  /**
   * Identifies the decisive fork with the highest divergence in outcomes.
   */
  public identifyDecisiveFork(): void {
    // TODO: Implement identification of the decisive fork.
  }
}

/**
 * Represents the run state at a given point in the game.
 */
export class RunState {
  constructor(public readonly outcome: number) {}
}

/**
 * Represents a single event in the run event log, containing the choice turn and run state.
 */
export class RunEventLog {
  constructor(private readonly events: Array<{ choiceTurn: number; runState: RunState }>) {}

  /**
   * Iterates through the events in this run event log.
   * @returns An iterator over the events in this run event log.
   */
  [Symbol.iterator](): IterableIterator<{ choiceTurn: number; runState: RunState }> {
    return this.events[Symbol.iterator]();
  }
}
