import React from 'react';

export default function SectionCard({
  title,
  subtitle,
  right,
  children,
  className = ''
}) {
  return (
    <section className={`section-card ${className}`.trim()}>
      <div className="section-head">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>

        {right && <div className="section-actions">{right}</div>}
      </div>

      <div className="section-content">
        {children}
      </div>
    </section>
  );
}