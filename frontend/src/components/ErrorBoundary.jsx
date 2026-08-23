import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-center" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>
              Algo salio mal
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Se produjo un error inesperado. Por favor, recarga la pagina.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Recargar pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
