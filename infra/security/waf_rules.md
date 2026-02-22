# WAF Rulepack for Bot Mitigation + DDoS Posture

## TypeScript Rules

### Strict Types and Export All Public Symbols

*   `typescript:disableAny` - Disables the use of the `any` type
*   `typescript:strictTypes` - Enables strict types checking
*   `typescript:exportAllPublicSymbols` - Exports all public symbols from modules

## Bash Rules

### Safe Defaults and Error Handling

*   `bash:set -euo pipefail` - Sets safe defaults for bash scripts, including:
    *   `-e`: Exit immediately if a command returns a non-zero status
    *   `-u`: Treat unset variables as an error when used in expressions
    *   `-o pipefail`: Fail the pipeline if any command in it returns a non-zero status

## ML Model Rules

### Bounded Outputs and Audit Hash

*   `ml:enabled` - Enables or disables machine learning models
*   `ml:boundedOutputs 0-1` - Ensures that model outputs are bounded between 0 and 1
*   `ml:auditHash` - Includes an audit hash for ML model outputs

## Engine Rules

### Preserve Determinism

*   `engine:determinism` - Preserves determinism in the game engine
