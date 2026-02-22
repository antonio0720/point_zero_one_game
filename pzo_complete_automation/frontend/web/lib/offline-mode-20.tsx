import React, { useState, useEffect } from 'react';
import { Storage } from 'react-native';

const OFFLINE_KEY = 'offlineMode';

function OfflineContext({ children }) {
const [isOffline, setIsOffline] = useState(false);

useEffect(() => {
async function checkOfflineStatus() {
const isOffline = await Storage.get(OFFLINE_KEY);
setIsOffline(!!isOffline);
}

checkOfflineStatus();
}, []);

const setOfflineMode = () => {
Storage.setItem(OFFLINE_KEY, true);
setIsOffline(true);
};

const exitOfflineMode = async () => {
await Storage.remove(OFFLINE_KEY);
setIsOffline(false);
};

return (
<OfflineContext.Provider value={{ isOffline, setOfflineMode, exitOfflineMode }}>
{children}
</OfflineContext.Provider>
);
}

const OfflineConsumer = OfflineContext.Consumer;

export { OfflineContext, OfflineConsumer };
