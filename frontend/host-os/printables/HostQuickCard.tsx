/**
 * Browser-renderable version of Host_QuickCard
 */

import React from 'react';
import moment from 'moment';
import QRCode from 'qrcode.react';

type Props = {
  hostId: string;
  gameStartTime: Date;
  gameEndTime?: Date | null;
};

const HostQuickCard: React.FC<Props> = ({ hostId, gameStartTime, gameEndTime }) => (
  <div className="host-quick-card">
    <div className="host-id">{hostId}</div>
    <div className="game-info">
      <div className="start-time">{moment(gameStartTime).format('YYYY-MM-DD HH:mm')}</div>
      {gameEndTime && <div className="end-time">{moment(gameEndTime).format('YYYY-MM-DD HH:mm')}</div>}
    </div>
    <div className="qr-code">
      <QRCode value={`https://pointzeroonegame.com/host/${hostId}`} />
    </div>
  </div>
);

export default HostQuickCard;
