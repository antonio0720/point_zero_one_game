import React, { useState } from 'react';
import { Navigator } from './Navigator';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';

const OfflineMode = () => {
const [isOffline, setIsOffline] = useState(navigator.onLine);

React.useEffect(() => {
const registration = Navigator.serviceWorker.register('/sw.js');
registration.then((registration) => {
ServiceWorkerRegistration.setRegistration(registration);
});

Navigator.onLine.addEventListener('change', () => {
setIsOffline(!navigator.onLine);
});
}, []);

return (
<>
{isOffline && (
<div style={{ textAlign: 'center' }}>You are offline!</div>
)}
<Navigator />
</>
);
};

export default OfflineMode;
