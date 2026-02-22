/**
 * MomentLogger component for capturing moments during live night in Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import moment from 'moment';

type MomentCode = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9';

interface Moment {
  code: MomentCode;
  timestamp: string;
  note?: string;
}

const MomentLogger = () => {
  const [moments, setMoments] = useState<Moment[]>([]);

  const captureMoment = (code: MomentCode, note?: string) => {
    const newMoment: Moment = { code, timestamp: moment().format(), note };
    setMoments([...moments, newMoment]);
  };

  return (
    <div>
      {['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'].map((code) => (
        <button key={code} onClick={() => captureMoment(code as MomentCode)}>
          {code}
        </button>
      ))}
      <ul>
        {moments.map((moment) => (
          <li key={moment.timestamp}>
            {moment.code}: {moment.timestamp} {moment.note ? `- ${moment.note}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MomentLogger;
