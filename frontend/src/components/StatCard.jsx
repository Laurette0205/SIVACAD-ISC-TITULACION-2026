import React from 'react';

export default function StatCard({ icon: Icon, label, value, hint, onClick, color }) {
  const isClickable = typeof onClick === 'function';
  const cardStyle = { borderLeft: color ? `4px solid ${color}` : undefined, borderRadius: 16, minHeight: 120, padding: '1rem 1.1rem', gap: '0.8rem' };
  const iconStyle = color ? { background: color, width: 46, height: 46, borderRadius: 12 } : undefined;

  if (isClickable) {
    return (
      <button
        type="button"
        className="stat-card is-clickable"
        onClick={onClick}
        aria-label={`Abrir panel de ${label}`}
        title={`Abrir panel de ${label}`}
        style={cardStyle}
      >
        <div className="stat-info" style={{ gap: '0.3rem' }}>
          <div className="stat-label" style={{ fontSize: '0.82rem' }}>{label}</div>
          <div className="stat-value" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>{value}</div>
          {hint && <div className="stat-hint" style={{ fontSize: '0.78rem' }}>{hint}</div>}
        </div>
        <div className="stat-icon" aria-hidden="true" style={iconStyle}>
          {Icon ? <Icon size={20} /> : null}
        </div>
      </button>
    );
  }

  return (
    <div className="stat-card" style={cardStyle}>
      <div className="stat-info" style={{ gap: '0.3rem' }}>
        <div className="stat-label" style={{ fontSize: '0.82rem' }}>{label}</div>
        <div className="stat-value" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>{value}</div>
        {hint && <div className="stat-hint" style={{ fontSize: '0.78rem' }}>{hint}</div>}
      </div>
      <div className="stat-icon" aria-hidden="true" style={iconStyle}>
        {Icon ? <Icon size={20} /> : null}
      </div>
    </div>
  );
}