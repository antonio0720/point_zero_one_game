/**
 * QuarantineAndAppeals component for Point Zero One Digital's financial roguelike game.
 */

import React, { FormEvent, useState } from 'react';
import axios from 'axios';
import { RateLimitIndicator } from '../RateLimitIndicator';

type AppealFormValues = {
  reason: string;
};

/**
 * QuarantineAndAppeals component.
 */
export const QuarantineAndAppeals: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<AppealFormValues>({ reason: '' });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await axios.post('/api/appeals', formValues);
      setFormValues({ reason: '' });
    } catch (error) {
      setError('An error occurred while submitting your appeal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Quarantine Explanation</h2>
      {/* Add quarantine explanation here */}

      <h3>Appeal Form</h3>
      <form onSubmit={handleSubmit}>
        <label htmlFor="reason">Reason for Appeal:</label>
        <textarea id="reason" value={formValues.reason} onChange={(e) => setFormValues({ ...formValues, reason: e.target.value })} />
        <button type="submit" disabled={isSubmitting}>Submit Appeal</button>
      </form>
      {error && <div>{error}</div>}
      <RateLimitIndicator />
    </div>
  );
};
