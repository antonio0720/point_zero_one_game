import React from 'react';
import { useGame } from '../game-context';
import { M114TimingTaxFastChoicesGetBetterTermsUIProps } from './types';

const M114TimingTaxFastChoicesGetBetterTermsUI = ({
  ml_enabled,
  audit_hash,
}: M114TimingTaxFastChoicesGetBetterTermsUIProps) => {
  const game = useGame();

  if (!game || !ml_enabled) return null;

  const timing_tax_fast_choices_get_better_terms_ui = (
    <div>
      <h2>Timing Tax: Fast Choices Get Better Terms</h2>
      <p>
        The faster you make your choices, the better terms you'll get. But be
        careful - rushing through can lead to costly mistakes.
      </p>
      <ul>
        {game.timing_tax_fast_choices_get_better_terms.map((term) => (
          <li key={term.id}>
            {term.name}: {term.description}
          </li>
        ))}
      </ul>
    </div>
  );

  return timing_tax_fast_choices_get_better_terms_ui;
};

export default M114TimingTaxFastChoicesGetBetterTermsUI;

interface M114TimingTaxFastChoicesGetBetterTermsUIProps {
  ml_enabled: boolean;
  audit_hash: string;
}
