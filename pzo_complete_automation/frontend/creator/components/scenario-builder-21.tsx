/**
 * ScenarioBuilder21 — Creator Studio scenario editor
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_complete_automation/frontend/creator/components/scenario-builder-21.tsx
 *
 * Fix log:
 *   [TS2307] @mui/material/Grid2 not found   → dropped Grid; layout via CSS grid divs (Row/HalfRow)
 *   [TS2322] SelectChange incompatible        → SelectChangeEvent<StepType> from @mui/material
 *   [TS7006 ×7] implicit e any                → InputChange alias on all TextField handlers
 */

import React, { useState, useCallback } from 'react';
import {
  Button, TextField, MenuItem, Select, SelectChangeEvent,
  InputLabel, FormControl, IconButton, Paper,
  Typography, Snackbar, Alert, Divider,
} from '@mui/material';
import { Scenario, ScenarioStep, StepType } from '../../models/Scenario';
import { addScenario }                      from '../../services/api';

// ── Explicit event aliases ────────────────────────────────────────────────────
type InputChange = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
// SelectChangeEvent<StepType> is the exact type MUI Select<StepType>.onChange expects — no custom alias needed

// ── Constants ─────────────────────────────────────────────────────────────────
const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: 'INCOME_CHOICE', label: 'Income Choice' },
  { value: 'EXPENSE_SHOCK', label: 'Expense Shock' },
  { value: 'MARKET_EVENT',  label: 'Market Event' },
  { value: 'FORK',          label: 'Fork (branch)' },
];

type FieldErrors = { name?: string; description?: string; steps?: string };

// ── Default step factory ──────────────────────────────────────────────────────
function makeDefaultStep(index: number): ScenarioStep {
  return {
    id:            `step-${Date.now()}-${index}`,
    type:          'INCOME_CHOICE',
    label:         '',
    description:   '',
    amountCents:   0,
    durationTurns: 1,
    branchOptions: [],
  };
}

// ── Layout helpers (replaces Grid — zero version deps) ────────────────────────
const Row: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 16 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap, marginBottom: gap }}>
    {children}
  </div>
);

const HalfRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
    {children}
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const ScenarioBuilder21: React.FC = () => {
  const [scenarioName,        setScenarioName]        = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [steps,               setSteps]               = useState<ScenarioStep[]>([]);
  const [submitting,          setSubmitting]           = useState(false);
  const [errors,              setErrors]               = useState<FieldErrors>({});
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // ── Step mutations ──────────────────────────────────────────────────────────
  const addStep = useCallback(() => {
    setSteps(prev => [...prev, makeDefaultStep(prev.length)]);
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setSteps(prev => {
      const next     = [...prev];
      const swapWith = direction === 'up' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }, []);

  const updateStep = useCallback(
    <K extends keyof ScenarioStep>(index: number, field: K, value: ScenarioStep[K]) => {
      setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    },
    [],
  );

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!scenarioName.trim())                  next.name = 'Scenario name is required.';
    else if (scenarioName.trim().length < 3)   next.name = 'Name must be at least 3 characters.';
    if (!scenarioDescription.trim())           next.description = 'Description is required.';
    if (steps.length === 0)                    next.steps = 'At least one step is required.';
    else if (steps.some(s => !s.label.trim())) next.steps = 'All steps must have a label.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const scenario: Scenario = {
        name:        scenarioName.trim(),
        description: scenarioDescription.trim(),
        steps,
      };
      await addScenario(scenario);
      setToast({ msg: `Scenario "${scenario.name}" created successfully!`, severity: 'success' });
      setScenarioName('');
      setScenarioDescription('');
      setSteps([]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setToast({ msg: `Failed to create scenario: ${msg}`, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ flexGrow: 1, padding: 24, maxWidth: 800 }}>
      <Typography variant="h5" sx={{ mb: 2.5, fontWeight: 700 }}>
        Scenario Builder
      </Typography>

      <form onSubmit={handleSubmit} noValidate>

        <Row>
          <TextField
            label="Scenario Name" fullWidth required
            value={scenarioName}
            onChange={(e: InputChange) => setScenarioName(e.target.value)}
            error={Boolean(errors.name)}
            helperText={errors.name}
            inputProps={{ maxLength: 100 }}
          />
        </Row>

        <Row>
          <TextField
            multiline rows={4} label="Scenario Description" fullWidth required
            value={scenarioDescription}
            onChange={(e: InputChange) => setScenarioDescription(e.target.value)}
            error={Boolean(errors.description)}
            helperText={errors.description}
            inputProps={{ maxLength: 1000 }}
          />
        </Row>

        <Divider sx={{ my: 2.5, background: '#2a2a3e' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Steps ({steps.length})
          </Typography>
          <Button variant="outlined" size="small" onClick={addStep}>+ Add Step</Button>
        </div>

        {errors.steps && (
          <p style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>{errors.steps}</p>
        )}
        {steps.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No steps yet. Add your first step above.
          </p>
        )}

        {steps.map((step, i) => (
          <Paper key={step.id} elevation={2} sx={{ p: 2, mb: 1.5, background: '#1a1a2e', borderRadius: 2 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#9ca3af', minWidth: 28 }}>Step {i + 1}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <IconButton size="small" onClick={() => moveStep(i, 'up')} disabled={i === 0}
                    title="Move up" aria-label={`Move step ${i + 1} up`} sx={{ p: '2px', fontSize: 10 }}>▲
                  </IconButton>
                  <IconButton size="small" onClick={() => moveStep(i, 'down')} disabled={i === steps.length - 1}
                    title="Move down" aria-label={`Move step ${i + 1} down`} sx={{ p: '2px', fontSize: 10 }}>▼
                  </IconButton>
                </div>
                <IconButton size="small" onClick={() => removeStep(i)}
                  title="Remove step" aria-label={`Remove step ${i + 1}`} sx={{ color: '#f87171' }}>✕
                </IconButton>
              </div>
            </div>

            {/* Type + Duration */}
            <HalfRow>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                {/* FIX [TS2322]: Select<StepType> + SelectChangeEvent<StepType> — exact match */}
                <Select<StepType>
                  value={step.type}
                  label="Type"
                  onChange={(e: SelectChangeEvent<StepType>) => updateStep(i, 'type', e.target.value)}
                >
                  {STEP_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>

              <TextField
                label="Duration (turns)" type="number" size="small" fullWidth
                value={step.durationTurns}
                onChange={(e: InputChange) =>
                  updateStep(i, 'durationTurns', Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                inputProps={{ min: 1, max: 50 }}
              />
            </HalfRow>

            {/* Label */}
            <Row gap={12}>
              <TextField
                label="Step Label" fullWidth size="small" required
                value={step.label}
                onChange={(e: InputChange) => updateStep(i, 'label', e.target.value)}
                inputProps={{ maxLength: 80 }}
                error={Boolean(errors.steps && !step.label.trim())}
              />
            </Row>

            {/* Amount */}
            <HalfRow>
              <TextField
                label="Amount (cents)" type="number" size="small" fullWidth
                value={step.amountCents}
                onChange={(e: InputChange) =>
                  updateStep(i, 'amountCents', parseInt(e.target.value, 10) || 0)
                }
                helperText={`$${(step.amountCents / 100).toFixed(2)}`}
                inputProps={{ min: 0 }}
              />
              <div />
            </HalfRow>

            {/* Step description */}
            <Row gap={12}>
              <TextField
                label="Step Description" fullWidth multiline rows={2} size="small"
                value={step.description}
                onChange={(e: InputChange) => updateStep(i, 'description', e.target.value)}
                inputProps={{ maxLength: 400 }}
              />
            </Row>

          </Paper>
        ))}

        <div style={{ marginTop: 16 }}>
          <Button type="submit" color="primary" variant="contained"
            disabled={submitting} sx={{ minWidth: 160 }}>
            {submitting ? 'Creating…' : 'Create Scenario'}
          </Button>
        </div>
      </form>

      <Snackbar open={Boolean(toast)} autoHideDuration={5000}
        onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? (
          <Alert onClose={() => setToast(null)} severity={toast.severity} variant="filled">
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </div>
  );
};

export default ScenarioBuilder21;