import React from 'react';
import { PersistGate } from 'redux-persist/integration/react';
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import rootReducer from './rootReducer';
import storage from 'redux-persist/lib/storage';
import { PersistConfig } from 'redux-persist';

const persistConfig: PersistConfig<any> = {
key: 'root',
storage,
};

const store = createStore(rootReducer, applyMiddleware(thunk));
const persistor = store.__createStore.persistStore(store);

interface Props {}

const OfflineMode5: React.FC<Props> = (props) => {
return (
<PersistGate loading={null} persistor={persistor}>
{(store) => <>{props.children}</>}
</PersistGate>
);
};

export default OfflineMode5;
