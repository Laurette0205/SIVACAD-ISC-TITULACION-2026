import React from 'react';

export default function StatCard({ icon: Icon, label, value, hint, onClick }) {
  const isClickable = typeof onClick === 'function';

  if (isClickable) {
    return (
      <button
        type="button"
        className="stat-card is-clickable"
        onClick={onClick}
        aria-label={`Abrir panel de ${label}`}
        title={`Abrir panel de ${label}`}
      >
        <div className="stat-info">
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          {hint && <div className="stat-hint">{hint}</div>}
        </div>

        <div className="stat-icon" aria-hidden="true">
          {Icon ? <Icon size={20} /> : null}
        </div>
      </button>
    );
  }

  return (
    <div className="stat-card">
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>

      <div className="stat-icon" aria-hidden="true">
        {Icon ? <Icon size={20} /> : null}
      </div>
    </div>
  );
}