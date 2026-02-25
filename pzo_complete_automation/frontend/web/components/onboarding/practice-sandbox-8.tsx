/**
 * PracticeSandbox8 — Average Age Challenge
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/frontend/web/components/onboarding/practice-sandbox-8.tsx
 *
 * Fix log:
 *   [TS2307] @chakra-ui/core  → migrated to @chakra-ui/react (React 19 ✓)
 *   [TS2307] ./CodeEditor, ./ChallengeCard, ./ExplanationModal  → created
 *   [TS2307] ../../stores/useOnboardingStore                    → created (Zustand)
 *   [TS2307] ../../data/onboarding-data                         → created
 *
 * Chakra v1 → v2 migration notes:
 *   Box, Heading, Text  — same names, same import path (@chakra-ui/react)
 *   No breaking API changes for these primitives between v1 and v2/v3
 *   Requires ChakraProvider wrapping the app (add to _app.tsx / main.tsx if not present)
 */

import React, { useState } from 'react';
import { Box, Heading, Text } from '@chakra-ui/react';   // v2/v3 — React 19 compatible
import CodeEditor             from './CodeEditor';
import ChallengeCard          from './ChallengeCard';
import ExplanationModal       from './ExplanationModal';
import useOnboardingStore     from '../../stores/useOnboardingStore';
import { PracticeSandbox8Data } from '../../data/onboarding-data';

// ── Test fixture types ────────────────────────────────────────────────────────

interface Person {
  name: string;
  age:  number;
}

interface TestCase {
  label:    string;
  input:    Person[];
  expected: number;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_CASES: TestCase[] = [
  {
    label:    'Basic 3-person array',
    input:    [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 20 }, { name: 'Carol', age: 40 }],
    expected: 30,
  },
  {
    label:    'Single person',
    input:    [{ name: 'Solo', age: 25 }],
    expected: 25,
  },
  {
    label:    'Non-integer average',
    input:    [{ name: 'X', age: 10 }, { name: 'Y', age: 11 }],
    expected: 10.5,
  },
];

// ── Submission result types ───────────────────────────────────────────────────

type TestStatus = 'pass' | 'fail' | 'error';

interface TestResult {
  label:    string;
  status:   TestStatus;
  expected: number;
  received: unknown;
  message?: string;
}

interface SubmissionResult {
  allPassed: boolean;
  results:   TestResult[];
}

// ── Code execution ────────────────────────────────────────────────────────────

function runTestCases(code: string): SubmissionResult {
  const results: TestResult[] = [];

  const fnNameMatch =
    code.match(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/) ??
    code.match(/(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/);

  if (!fnNameMatch) {
    return {
      allPassed: false,
      results: TEST_CASES.map(tc => ({
        label:    tc.label,
        status:   'error' as TestStatus,
        expected: tc.expected,
        received: undefined,
        message:  'No function found. Define a function that takes an array of people.',
      })),
    };
  }

  const fnName = fnNameMatch[1];

  for (const tc of TEST_CASES) {
    try {
      // eslint-disable-next-line no-new-func
      const executor = new Function('input', `${code}\n; return ${fnName}(input);`);
      const received = executor(tc.input);
      const pass     = typeof received === 'number' && Math.abs(received - tc.expected) < 1e-9;

      results.push({ label: tc.label, status: pass ? 'pass' : 'fail', expected: tc.expected, received });
    } catch (err) {
      results.push({
        label:    tc.label,
        status:   'error',
        expected: tc.expected,
        received: undefined,
        message:  err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { allPassed: results.every(r => r.status === 'pass'), results };
}

// ── Component ─────────────────────────────────────────────────────────────────

const PracticeSandbox8 = () => {
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [selectedCode,      setSelectedCode]      = useState('');
  const [submission,        setSubmission]         = useState<SubmissionResult | null>(null);
  const [hasCompleted,      setHasCompleted]       = useState(false);

  const onboardingStore = useOnboardingStore();

  const handleCodeSelect = (code: string) => {
    setSelectedCode(code);
    setIsExplanationOpen(true);
  };

  const handleCodeSubmit = (code: string) => {
    if (!code.trim()) return;
    const result = runTestCases(code);
    setSubmission(result);
    if (result.allPassed && !hasCompleted) {
      setHasCompleted(true);
      onboardingStore.incrementCompletedStep();
    }
  };

  return (
    <ChallengeCard>
      <Box>
        <Heading size="xl" mb={4}>
          Practice Sandbox 8
        </Heading>
        <Text fontSize="lg" mb={6}>
          Write a function that takes an array of objects as input, and returns
          the average age of all people in the array.
        </Text>
        <Text fontSize="sm" color="gray.400" mb={2}>
          Example input:{' '}
          <code>[{'{ name: "Alice", age: 30 }, { name: "Bob", age: 20 }'}]</code>
          <br />
          Expected output: <code>25</code>
        </Text>
      </Box>

      <CodeEditor
        onCodeSelect={handleCodeSelect}
        onCodeSubmit={handleCodeSubmit}
      />

      {/* Submission feedback */}
      {submission && (
        <Box mt={4} p={4} borderRadius="md" bg={submission.allPassed ? 'green.900' : 'red.900'}>
          <Text fontWeight="bold" mb={2} color={submission.allPassed ? 'green.300' : 'red.300'}>
            {submission.allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}
          </Text>

          {submission.results.map((r, i) => (
            <Box
              key={i} mb={2} pl={3}
              borderLeft="3px solid"
              borderColor={r.status === 'pass' ? 'green.400' : r.status === 'fail' ? 'red.400' : 'yellow.400'}
            >
              <Text fontSize="sm" fontWeight="600">
                {r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⚠'} {r.label}
              </Text>
              {r.status !== 'pass' && (
                <Text fontSize="xs" color="gray.300">
                  {r.status === 'error'
                    ? `Error: ${r.message}`
                    : `Expected ${r.expected}, got ${JSON.stringify(r.received)}`}
                </Text>
              )}
            </Box>
          ))}

          {submission.allPassed && (
            <Text fontSize="sm" color="green.200" mt={2}>
              Step complete — moving to next challenge.
            </Text>
          )}
        </Box>
      )}

      <ExplanationModal
        isOpen={isExplanationOpen}
        onClose={() => setIsExplanationOpen(false)}
      >
        {PracticeSandbox8Data.explanation}
      </ExplanationModal>
    </ChallengeCard>
  );
};

export default PracticeSandbox8;
