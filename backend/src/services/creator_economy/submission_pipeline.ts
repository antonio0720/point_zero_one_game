/**
 * Submission pipeline service for Creator Economy
 */

import { EventEmitter } from 'events';
import { ISubmission, ISubmissionEvent, IPipelineState } from './interfaces';

// Interface for the submission pipeline states
interface IStateMachine {
  ingest: IPipelineState;
  lint: IPipelineState;
  policyScan: IPipelineState;
  verify: IPipelineState;
  sandboxPlacement: IPipelineState;
}

// Submission pipeline state machine
class Pipeline extends EventEmitter {
  private _stateMachine: IStateMachine;
  private _submission: ISubmission;
  private _currentState: keyof IStateMachine;

  constructor() {
    super();
    this._stateMachine = {
      ingest: {
        onEnter: this.ingest,
        transitions: ['lint'],
      },
      lint: {
        onEnter: this.lint,
        transitions: ['policyScan', 'fail'],
      },
      policyScan: {
        onEnter: this.policyScan,
        transitions: ['verify', 'fail'],
      },
      verify: {
        onEnter: this.verify,
        transitions: ['sandboxPlacement', 'fail'],
      },
      sandboxPlacement: {
        onEnter: this.sandboxPlacement,
        transitions: ['success', 'fail'],
      },
    };
    this._submission = {} as ISubmission;
    this._currentState = 'ingest';
  }

  public set submission(value: ISubmission) {
    this._submission = value;
  }

  // Transition to the next state based on the current state and available transitions
  private transition(transition: keyof IStateMachine[]) {
    const nextState = this._currentState + transition[0];
    if (this._stateMachine[nextState]) {
      this._currentState = nextState;
      this._stateMachine[nextState].onEnter();
      this.emit('transition', { state: this._currentState, submission: this._submission });
    } else {
      this.emit('error', 'Invalid transition');
    }
  }

  // Ingest function for the ingest state
  private ingest() {
    this.emit('info', 'Submission received');
  }

  // Lint function for the lint state
  private lint() {
    this.emit('info', 'Linting submission...');
    // Simulate linting process and transition based on result
    if (this.lintResult()) {
      this.transition(['policyScan']);
    } else {
      this.transition(['fail']);
    }
  }

  // Policy scan function for the policyScan state
  private policyScan() {
    this.emit('info', 'Scanning submission against policies...');
    // Simulate policy scan process and transition based on result
    if (this.policyScanResult()) {
      this.transition(['verify']);
    } else {
      this.transition(['fail']);
    }
  }

  // Verify function for the verify state
  private verify() {
    this.emit('info', 'Verifying submission...');
    // Simulate verification process and transition based on result
    if (this.verifyResult()) {
      this.transition(['sandboxPlacement']);
    } else {
      this.transition(['fail']);
    }
  }

  // Sandbox placement function for the sandboxPlacement state
  private sandboxPlacement() {
    this.emit('info', 'Sandboxing and placing submission...');
    // Simulate sandboxing and placement process and transition based on result
    if (this.sandboxPlacementResult()) {
      this.transition(['success']);
    } else {
      this.transition(['fail']);
    }
  }

  // Helper function to simulate linting result
  private lintResult(): boolean {
    return true;
  }

  // Helper function to simulate policy scan result
  private policyScanResult(): boolean {
    return true;
  }

  // Helper function to simulate verification result
  private verifyResult(): boolean {
    return true;
  }

  // Helper function to simulate sandbox placement result
  private sandboxPlacementResult(): boolean {
    return true;
  }
}

export { Pipeline, ISubmissionEvent };
