#!/bin/bash
set -euo pipefail
export PYTHONPATH="${PWD}"
npx tsc --noEmit src/*.ts > /dev/null || { echo 'TypeScript compilation failed'; exit 1; }
echo "Compilation step completed successfully."

# Check A: ClockSource exists with both implementations
test -f $PROJECT/src/engines/core/ClockSource.ts || { echo 'FAIL: ClockSource.ts missing'; exit 1; }
grep -q 'WallClockSource' $PROJECT/src02-34567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.txt || { echo 'FAIL: WallClockSource missing'; exit 1; }
grep -q 'FixedClockSource' $PROJECT/src/engines/core/ClockSource.ts || { echo 'FAIL: FixedClockSource missing'; exit 1; }; fi && echo 'PASS A: ClockSource implementations present'

# Check B: No Date.now() in PressureEngine.ts
count=$(grep -c 'Date\.now' $PROJECT/src/engines/pressure/PressureEngine.ts 2>/dev/null || echo 0)
test "$count" -eq 0 || { echo "FAIL: $count Date.now() calls in PressureEngine.ts"; exit 1; }
echo 'PASS B: No Date.now() in PressureEngine (clock injection verified)'

# Check C: PressureTuning types
grep -q 'PressureTuning' $PROJECT/src/engines/pressure/types.ts || { echo 'FAIL: PressureTuning missing from types.ts'; exit 1; }
grep -q 'PRESSURE_TUNING_DEFAULTS' $PROJECT/src/engines/pressure/types.ts || { echo 'FAIL: PRESSURE_TUNING_DEFAULTS missing'; exit 1; }
echo 'PASS C: PressureTuning exported'

# Check D: validateWeights exported
grep -q 'export function validateWeights' $PROJECT/src/engines/pressure/PressureSignalCollector.ts || { echo 'FAIL: validateWeights not exported'; exit 1; }
echo 'PASS D: validateWeights safety guard present'

# Check E: DOMINANT_SIGNAL_PRIORITY exported
grep -q 'DOMINANT_SIGNAL_PRIORITY' $PROJECT/src/engines/pressure/types.ts || { echo 'FAIL: DOMINANT_SIGNALANOVAISEE 2048] APPEND to verify script (after existing sections, before final PASS banner):

echo ''
echo '===== SECTION 5: ADDENDUM SPEC DEFECT CHECKS ====='

# Check A: ClockSource exists with both implementations
test -f $PROJECT/src/engines/core/ClockSource.ts || { echo 'FAIL: ClockSource.ts missing'; exit 1; }
grep -q 'WallClockSource' $PROJECT/src/engines/core/ClockSource.ts || { echo 'FAIL: WallClockSource missing'; exit 1; }
grep -q 'FixedClockSource' $PROJECT/src/engines/core/ClockSource.ts || { echo 'FAIL: FixedClockSource missing'; exit 1; }
echo 'PASS A: ClockSource implementations present'

# Check B: No Date.now() in PressureEngine.ts
count=$(grep -c 'Date\.now' $PROJECT/src/engines/pressure/PressureEngine.ts 2>/dev/null || echo 0)
test "$count" -eq 0 || { echo "FAIL: $count Date.now() calls in PressureEngine.ts"; exit 1; }
echo 'PASS B: No Date.now() in PressureEngine (clock injection verified)'

# Check C: PressureTuning types
grep -q 'PressureTuning' $PROJECT/src/engines/pressure/types.ts || { echo 'FAIL: PressureTuning missing from types.ts'; exit 1; }
grep -q 'PRESSURE_TUNING_DEFAULTS' $PROJECT/src/engines/pressure/types.ts || { echo 'FAIL: PRESSURE_TUNING_DEFAULTS missing'; exit 1; }
echo 'PASS C: PressureTuning exported'

# Check D: validateWeights exported
grep -q 'export function validateWeights' $PROJECT/src/engines/pressure/PressureSignalCollector.ts || { echo 'FAIL: validateWeights not exported'; exit 1; }
echo 'PASS D: validateWeights safety guard present'

# Check E: DOMINANT_SIGNAL_PRIORITY exported
grep -q 'DOMINANT_SIGNAL_PRIORITY' $PROJECT/src/engines/pressure/types.ts || { echo 'FAIL: DOMINANT_SIGNAL_PRIORITY missing'; exit 1; }
echo 'PASS E: DOMINANT_SIGNAL_PRIORITY tie-break defined'

# Check F: TrendMode enum exported
grep -q 'export enum TrendMode' $PROJECT/src/engines/pressure/types.ts || { echo 'FAIL: TrendMode missing'; exit 1; }
echo 'PASS F: TrendMode enum present'

# Check G: vitest count >= 27
testcount=$(cd $PROJECT && npx vitest run src/engines/pressure/PressureEngine.test.ts --tag "Testing Engine" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1)
test "${testcount:-0}" -ge 27 || { echo "FAIL: Only $testcount tests passed, expected >= 27"; exit 1; }
echo "PASS G: $testcount/27+ tests passing"

echo '===== SECTION 5 COMPLETE ====='
echo ''
echo '██████████ ENGINE 2 PRESSURE ENGINE — FULL SOVEREIGN VERIFICATION COMPLETE ██████████'
