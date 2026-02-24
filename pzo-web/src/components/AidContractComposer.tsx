/**
 * AidContractComposer.tsx — Alliance Aid Contract UI
 * Compose and submit aid contracts to alliance members.
 */

import React, { useState, useCallback } from 'react';

export type AidType = 'CASH' | 'SHIELD' | 'INTEL' | 'SABOTAGE_BLOCK';

export interface AidContractComposerProps {
  allianceMembers: { id: string; displayName: string; netWorth: number }[];
  senderCash: number;
  maxAidPct: number;   // 0-1, max % of sender's cash
  onSubmit?: (contract: AidContract) => void;
  onCancel?: () => void;
}

export interface AidContract {
  recipientId: string;
  aidType: AidType;
  amount: number;
  message: string;
}

const AID_LABELS: Record<AidType, string> = {
  CASH:           '💰 Cash Transfer',
  SHIELD:         '🛡 Defensive Shield',
  INTEL:          '🔍 Market Intel',
  SABOTAGE_BLOCK: '🚫 Sabotage Block',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function AidContractComposer({
  allianceMembers,
  senderCash,
  maxAidPct,
  onSubmit,
  onCancel,
}: AidContractComposerProps) {
  const [recipientId, setRecipientId] = useState(allianceMembers[0]?.id ?? '');
  const [aidType,     setAidType]     = useState<AidType>('CASH');
  const [amount,      setAmount]      = useState(0);
  const [message,     setMessage]     = useState('');
  const [error,       setError]       = useState('');

  const maxAmount = Math.floor(senderCash * maxAidPct);

  const handleSubmit = useCallback(() => {
    setError('');
    if (!recipientId) { setError('Select a recipient'); return; }
    if (amount <= 0)   { setError('Amount must be > 0'); return; }
    if (amount > maxAmount) { setError(`Max aid: ${fmt(maxAmount)}`); return; }

    onSubmit?.({ recipientId, aidType, amount, message });
  }, [recipientId, aidType, amount, message, maxAmount, onSubmit]);

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 space-y-3 w-full max-w-sm">
      <h3 className="text-xs font-mono font-bold text-zinc-300 tracking-widest">AID CONTRACT</h3>

      {/* Recipient */}
      <div className="space-y-1">
        <label className="text-[10px] font-mono text-zinc-500">RECIPIENT</label>
        <select
          value={recipientId}
          onChange={e => setRecipientId(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5"
        >
          {allianceMembers.map(m => (
            <option key={m.id} value={m.id}>
              {m.displayName} ({fmt(m.netWorth)})
            </option>
          ))}
        </select>
      </div>

      {/* Aid type */}
      <div className="space-y-1">
        <label className="text-[10px] font-mono text-zinc-500">AID TYPE</label>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(AID_LABELS) as AidType[]).map(type => (
            <button
              key={type}
              onClick={() => setAidType(type)}
              className={`text-[10px] py-1.5 px-2 rounded border text-left transition-colors ${
                aidType === type
                  ? 'bg-indigo-950 border-indigo-600 text-indigo-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {AID_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      {aidType === 'CASH' && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[10px] font-mono text-zinc-500">AMOUNT</label>
            <span className="text-[10px] font-mono text-zinc-600">max {fmt(maxAmount)}</span>
          </div>
          <input
            type="number"
            value={amount || ''}
            onChange={e => setAmount(Number(e.target.value))}
            placeholder="0"
            min={0}
            max={maxAmount}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5"
          />
        </div>
      )}

      {/* Message */}
      <div className="space-y-1">
        <label className="text-[10px] font-mono text-zinc-500">MESSAGE (optional)</label>
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="援助メッセージ..."
          maxLength={80}
          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-[10px] text-red-400 font-mono">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded border border-zinc-700"
          >
            CANCEL
          </button>
        )}
        <button
          onClick={handleSubmit}
          className="flex-1 py-1.5 text-xs bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded"
        >
          SEND AID
        </button>
      </div>
    </div>
  );
}

export default AidContractComposer;