import React from 'react';
import { useM23 } from './useM23';

interface M23Props {
  mlEnabled: boolean;
}

const M23 = ({ mlEnabled }: M23Props) => {
  const { autoClip, captionPackager } = useM23(mlEnabled);

  return (
    <div className="m023">
      <h2>Auto-Clip + Caption Packager (M23)</h2>
      <p>
        This is the UI for the Auto-Clip + Caption Packager (M23) mechanism.
      </p>
      {autoClip && (
        <div>
          <h3>Auto-Clip</h3>
          <p>
            The auto-clip feature automatically clips the player's movement to
            prevent them from moving outside of the game world.
          </p>
        </div>
      )}
      {captionPackager && (
        <div>
          <h3>Caption Packager</h3>
          <p>
            The caption packager feature packages captions for the game, making
            it easier to manage and display them.
          </p>
        </div>
      )}
    </div>
  );
};

export default M23;
