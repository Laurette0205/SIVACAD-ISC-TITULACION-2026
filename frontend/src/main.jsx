import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Componente principal
import App from './App';

// Estilos globales
import './styles/global.css';

// Suprimir error conocido de React DevTools (startTime undefined)
const originalConsoleError = console.error;
console.error = (...args) => {
  const msg = args[0];
  if (typeof msg === 'string' && msg.includes('startTime')) return;
  originalConsoleError.apply(console, args);
};

/**
 * ==========================================
 * RENDER PRINCIPAL DE LA APLICACIÓN
 * ==========================================
 */
ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);