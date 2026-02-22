/**
 * Loss package page component for Point Zero One Digital's financial roguelike game.
 * This component displays the Cause-of-Death card, Fork button, Train weakness button, and autopsy snippet player.
 */

import React from 'react';
import { Card, Button } from '@material-ui/core';
import AutopsyPlayer from './AutopsyPlayer';

interface Props {
  runId: string;
}

const LossPage: React.FC<Props> = ({ runId }) => {
  return (
    <Card>
      {/* Cause-of-Death card */}
      <div>Cause of Death</div>

      {/* Fork button */}
      <Button variant="contained" color="primary">
        Fork
      </Button>

      {/* Train weakness button */}
      <Button variant="contained" color="secondary">
        Train Weakness
      </Button>

      {/* Autopsy snippet player */}
      <AutopsyPlayer runId={runId} />
    </Card>
  );
};

export default LossPage;
