import React from 'react';
import { useM38 } from './useM38';
import { M38State } from './types';

const M038 = () => {
  const { state, dispatch } = useM38();

  if (!state.momentQuests) return null;

  const momentQuests = state.momentQuests.map((momentQuest, index) => (
    <div key={index}>
      <h2>{momentQuest.name}</h2>
      <p>Share this quest to unlock a reward!</p>
      <button onClick={() => dispatch({ type: 'SHARE_QUEST', payload: momentQuest.id })}>
        Share Quest
      </button>
    </div>
  ));

  return (
    <div className="virality-surface">
      <h1>Moment Quests</h1>
      {momentQuests}
    </div>
  );
};

export default M038;
