import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './styles/global.css';

ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      console.warn('[SW] Service worker registration failed');
    });
  });
}
