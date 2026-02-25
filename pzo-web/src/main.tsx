/**
 * /Users/mervinlarry/point_zero_one_master/pzo-web/src/main.tsx
 */

import React             from 'react';
import ReactDOM          from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import App               from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider value={{} as any}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
);