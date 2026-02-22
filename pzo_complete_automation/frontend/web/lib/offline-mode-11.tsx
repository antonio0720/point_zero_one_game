import React from 'react';
import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const OfflineMode = () => {
const checkOnlineStatus = () => {
if (navigator.onLine) {
localStorage.removeItem('offline');
} else {
localStorage.setItem('offline', 'true');
}
};

useEffect(() => {
checkOnlineStatus();
window.addEventListener('online', checkOnlineStatus);
window.addEventListener('offline', checkOnlineStatus);

return () => {
window.removeEventListener('online', checkOnlineStatus);
window.removeEventListener('offline', checkOnlineStatus);
};
}, []);

const isOffline = localStorage.getItem('offline') === 'true';

if (isOffline) {
return <h1>You are offline!</h1>;
}

return <Outlet />;
};

export default OfflineMode;
