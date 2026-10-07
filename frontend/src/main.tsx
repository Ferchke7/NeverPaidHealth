import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryProvider } from './app/providers/QueryProvider.tsx';
import { App } from './app/App.tsx';
import { registerServiceWorker } from './shared/lib/pwa/registerServiceWorker.ts';
import './app/styles/globals.css';

// Register PWA service worker
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </React.StrictMode>
);

