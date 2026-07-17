import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Componente principal
import App from './App';

// Estilos globales
import './styles/global.css';

/**
 * ==========================================
 * RENDER PRINCIPAL DE LA APLICACIÓN
 * ==========================================
 */
ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);