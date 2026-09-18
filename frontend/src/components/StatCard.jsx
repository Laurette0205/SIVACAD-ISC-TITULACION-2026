import React from 'react';

const COLOR_MAP = {
  '#6366f1': 'info',
  '#3b82f6': 'info',
  '#10b981': 'success',
  '#f59e0b': 'warning',
  '#ef4444': 'error',
  '#dc2626': 'error',
};

export default function StatCard({ icon: Icon, label, value, hint, onClick, color }) {
  const isClickable = typeof onClick === 'function';
  const accent = color ? (COLOR_MAP[color] || null) : null;

  return (
    <button
      type="button"
      className={`stat-card${isClickable ? ' is-clickable' : ''}`}
      onClick={onClick}
      aria-label={isClickable ? `Abrir panel de ${label}` : undefined}
      title={isClickable ? `Abrir panel de ${label}` : undefined}
      data-accent={accent}
    >
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
      <div className="stat-icon" aria-hidden="true" style={color ? { background: color } : undefined}>
        {Icon ? <Icon size={20} /> : null}
      </div>
    </button>
  );
}
