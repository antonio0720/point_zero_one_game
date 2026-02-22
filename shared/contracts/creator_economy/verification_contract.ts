/**
 * VerificationContract Interface for Creator Economy
 */

interface VerificationReport {
  /** Unique identifier for the verification report */
  id: string;

  /** Timestamp when the verification report was created */
  timestamp: Date;

  /** The budget check output for the verification report */
  budgetCheckOutput: BudgetCheckOutput;

  /** Deterministic replay check result for the verification report */
  deterministicReplayCheckResult: boolean;

  /** List of failure fixes applied during the verification process */
  failureFixList: FailureFix[];
}

/** Output schema for budget check */
interface BudgetCheckOutput {
  /** Total budget spent during the game session */
  totalBudgetSpent: number;

  /** Maximum allowed budget for the game session */
  maxAllowedBudget: number;
}

/** Schema for failure fixes applied during verification process */
interface FailureFix {
  /** Unique identifier for the failure fix */
  id: string;

  /** Timestamp when the failure fix was applied */
  timestamp: Date;

  /** Description of the failure and the fix applied */
  description: string;
}
