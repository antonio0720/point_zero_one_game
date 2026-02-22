import React, { useEffect, useState } from 'react';
import { OfflineContext } from './OfflineContext';
import { OfflineStatus } from './OfflineStatus';

export const OfflineMode2 = () => {
const [isOffline, setIsOffline] = useState(false);

useEffect(() => {
const handleOnline = () => setIsOffline(false);
const handleOffline = () => setIsOffline(true);

window.addEventListener('offline', handleOffline);
window.addEventListener('online', handleOnline);

return () => {
window.removeEventListener('offline', handleOffline);
window.removeEventListener('online', handleOnline);
};
}, []);

return (
<OfflineContext.Provider value={isOffline}>
<OfflineStatus />
{/* Your main app content */}
</OfflineContext.Provider>
);
};
