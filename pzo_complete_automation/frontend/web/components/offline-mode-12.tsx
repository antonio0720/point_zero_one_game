import * as React from 'react';
import { useEffect } from 'react';

const OfflineMode = () => {
const [isOffline, setIsOffline] = React.useState(true);

useEffect(() => {
const handleOnline = () => setIsOffline(false);
const handleOffline = () => setIsOffline(true);

window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

return () => {
window.removeEventListener('online', handleOnline);
window.removeEventListener('offline', handleOffline);
};
}, []);

if (isOffline) {
return <div>Offline Mode: This application is currently in offline mode.</div>;
}

return null;
};

export default OfflineMode;
