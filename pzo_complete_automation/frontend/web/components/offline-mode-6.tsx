import React from 'react';

const OfflineModeIndicator = () => {
const checkConnection = () => {
if (!navigator.onLine) {
// Perform actions for offline mode (e.g., displaying a message, disabling certain features)
}
};

React.useEffect(() => {
checkConnection();
window.addEventListener('online', checkConnection);
window.addEventListener('offline', checkConnection);

return () => {
window.removeEventListener('online', checkConnection);
window.removeEventListener('offline', checkConnection);
};
}, []);

return null;
};

export default OfflineModeIndicator;
