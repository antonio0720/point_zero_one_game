'use client';
import React, { useReducer } from 'react';

export type Visibility = 'Public' | 'Unlisted' | 'Private';
export interface RunPrivacy { visibility: Visibility; }
export const initialState: RunPrivacy = { visibility: 'Unlisted' };
export enum PrivacyActionType { SET_VISIBILITY = 'SET_VISIBILITY' }
export interface SetVisibilityAction { type: PrivacyActionType.SET_VISIBILITY; visibility: Visibility; }
export type PrivacyActions = SetVisibilityAction;
export const privacyReducer = (state: RunPrivacy = initialState, action: PrivacyActions): RunPrivacy => {
  switch (action.type) {
    case PrivacyActionType.SET_VISIBILITY: return { ...state, visibility: action.visibility };
    default: return state;
  }
};

const OPTIONS: { value: Visibility; label: string; description: string }[] = [
  { value: 'Public',   label: 'Public',   description: 'Anyone can view this run on the explorer.' },
  { value: 'Unlisted', label: 'Unlisted', description: 'Only people with the direct link can view.' },
  { value: 'Private',  label: 'Private',  description: 'Only you can view this run.' },
];

export default function PrivacySettingsPage() {
  const [state, dispatch] = useReducer(privacyReducer, initialState);
  return (
    <main className="max-w-lg mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Run Privacy</h1>
      <p className="text-gray-500 text-sm mb-8">Control who can see your run replays and proof cards.</p>
      <div className="flex flex-col gap-3">
        {OPTIONS.map(({ value, label, description }) => (
          <button key={value} onClick={() => dispatch({ type: PrivacyActionType.SET_VISIBILITY, visibility: value })}
            className={`flex items-start gap-4 rounded-lg border p-4 text-left transition ${state.visibility === value ? 'border-white bg-gray-900' : 'border-gray-700 hover:border-gray-500'}`}
            aria-pressed={state.visibility === value}>
            <span className={`mt-1 h-4 w-4 rounded-full border-2 flex-shrink-0 ${state.visibility === value ? 'border-white bg-white' : 'border-gray-500'}`} />
            <span>
              <span className="block font-semibold text-sm">{label}</span>
              <span className="block text-xs text-gray-400 mt-0.5">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
