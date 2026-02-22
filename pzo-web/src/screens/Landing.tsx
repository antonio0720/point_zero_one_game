import React from 'react';
import { useAppDispatch } from '../store/hooks';
import { setSeed } from '../store/slices/gameSlice';
import { mlEnabled } from '../utils/constants';

const Landing = () => {
  const dispatch = useAppDispatch();
  const [seed, setSeedValue] = React.useState('');
  const [dailySeed, setDailySeed] = React.useState('');

  const handleSeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSeedValue(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch(setSeed(seed));
  };

  return (
    <div className="landing-container">
      <h1>Point Zero One Digital</h1>
      {mlEnabled ? (
        <p>
          This game is powered by machine learning.{' '}
          <a
            href={`https://www.auditlog.com/${auditHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View audit log
          </a>
        </p>
      ) : null}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={seed}
          onChange={handleSeedChange}
          placeholder="Enter seed (optional)"
        />
        <button type="submit">Start Run</button>
      </form>
      {dailySeed ? (
        <div className="daily-seed-badge">
          Daily Seed: {dailySeed}
        </div>
      ) : null}
    </div>
  );
};

export default Landing;
