import React from 'react';
import { useOfflineContext } from '../../contexts/OfflineContext';

const OfflineModeIndicator = () => {
const { isOffline } = useOfflineContext();

return <div className={isOffline ? "offline-mode" : "online-mode"}>{isOffline ? "You are offline." : "You are online."}</div>;
};

export default OfflineModeIndicator;
