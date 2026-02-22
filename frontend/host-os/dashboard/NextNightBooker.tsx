/**
 * NextNightBooker component for Point Zero One Digital's financial roguelike game dashboard.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import dayjs from 'dayjs';
import Link from 'next/link';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const DatePicker = styled.input`
  /* Add your custom styles here */
`;

const FormatSelector = styled.select`
  /* Add your custom styles here */
`;

const ThemePicker = styled.select`
  /* Add your custom styles here */
`;

interface Props {
  onNextSession: (date: string, format: string, theme: string) => void;
}

const NextNightBooker: React.FC<Props> = ({ onNextSession }) => {
  const [date, setDate] = useState(dayjs().add(1, 'days').format('YYYY-MM-DD'));
  const [format, setFormat] = useState('Casual');
  const [theme, setTheme] = useState('Risk');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onNextSession(date, format, theme);
  };

  return (
    <Wrapper>
      <form onSubmit={handleSubmit}>
        <DatePicker type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <FormatSelector value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="Casual">Casual</option>
          <option value="Community">Community</option>
          <option value="Competitive">Competitive</option>
        </FormatSelector>
        <ThemePicker value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="Risk">Risk</option>
          <option value="Speed">Speed</option>
          <option value="Betrayal">Betrayal</option>
        </ThemePicker>
        <button type="submit">Book Next Session</button>
      </form>
      <Link href={`/game?date=${encodeURIComponent(date)}&format=${encodeURIComponent(format)}&theme=${encodeURIComponent(theme)}`}>
        <a target="_blank" rel="noopener noreferrer">Share Invite Link</a>
      </Link>
    </Wrapper>
  );
};

export default NextNightBooker;
