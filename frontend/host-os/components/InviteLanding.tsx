/**
 * InviteLanding component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type Props = {
  hostName: string;
  nightFormat: string;
  date: string;
  playerCount: number;
  gameExplanation: string[];
  onRSVPReview: () => void;
  playSoloLink: string;
};

const InviteLanding: React.FC<Props> = ({
  hostName,
  nightFormat,
  date,
  playerCount,
  gameExplanation,
  onRSVPReview,
  playSoloLink,
}) => {
  return (
    <div>
      <h1>{hostName}</h1>
      <p>Night format: {nightFormat}</p>
      <p>Date: {date}</p>
      <p>Players: {playerCount}</p>
      <ul>
        {gameExplanation.map((sentence, index) => (
          <li key={index}>{sentence}</li>
        ))}
      </ul>
      <button onClick={onRSVPReview}>RSVP</button>
      <a href={playSoloLink}>Play Solo First</a>
    </div>
  );
};

export default InviteLanding;
