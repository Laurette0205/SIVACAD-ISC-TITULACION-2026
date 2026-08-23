import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ text = 'Cargando...' }) => (
  <div className="page-center" role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
    <Loader2 className="animate-spin" size={32} style={{ color: '#2563eb' }} />
    <span style={{ color: '#6b7280' }}>{text}</span>
  </div>
);

export default LoadingSpinner;
