import React from 'react';
import { FileText } from 'lucide-react';

const labelStyle = {
  fontWeight: 600,
  color: '#1e40af',
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.1rem'
};

const valueStyle = {
  color: '#0f172a',
  fontSize: '0.9rem',
  fontWeight: 500
};

export default function KardexPreview({ data, loading, error, onExportPDF, onExportExcel }) {
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Cargando vista previa...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <FileText size={48} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
        <p>No hay datos de kardex para mostrar.</p>
        <p style={{ fontSize: '0.8rem' }}>Consulta un alumno para previsualizar su kardex.</p>
      </div>
    );
  }

  const { folio, fecha_emision, zona_horaria, alumno, historial, sellos, firma_electronica, nota_institucional } = data;

  const hasHistorial = Array.isArray(historial) && historial.length > 0;

  return (
    <div className="kardex-preview">
      {/* Header */}
      <div className="preview-header">
        <div className="preview-title-block">
          <h2 className="preview-title">KARDEX DEL ALUMNO</h2>
          <p className="preview-subtitle">SISTEMA INTEGRAL DE VALIDACIÓN Y CONTROL ACADÉMICO</p>
        </div>
        <div className="preview-meta">
          <span>Folio: <strong>{folio || '\u2014'}</strong></span>
          <span>Emitido: {fecha_emision || '\u2014'}</span>
          <span>Zona horaria: {zona_horaria || '\u2014'}</span>
        </div>
      </div>

      {/* Student Data */}
      <div className="preview-section">
        <h3 className="preview-section-title">DATOS DEL ALUMNO</h3>
        <div className="preview-alumno-grid">
          <div className="preview-alumno-photo">
            {alumno.fotografia_url ? (
              <img
                src={alumno.fotografia_url}
                alt="Foto institucional"
                className="preview-photo-img"
              />
            ) : (
              <div className="preview-photo-placeholder">
                {(alumno.nombre_completo || 'A').charAt(0)}
              </div>
            )}
          </div>
          <div className="preview-alumno-data">
            <div className="preview-field">
              <span style={labelStyle}>Nombre Completo</span>
              <span style={valueStyle}>{alumno.nombre_completo || '\u2014'}</span>
            </div>
            <div className="preview-field-row">
              <div className="preview-field">
                <span style={labelStyle}>Matrícula</span>
                <span style={valueStyle}>{alumno.matricula || '\u2014'}</span>
              </div>
              <div className="preview-field">
                <span style={labelStyle}>CURP</span>
                <span style={valueStyle}>{alumno.curp || '\u2014'}</span>
              </div>
            </div>
            <div className="preview-field-row">
              <div className="preview-field">
                <span style={labelStyle}>Carrera</span>
                <span style={valueStyle}>{alumno.carrera || '\u2014'}</span>
              </div>
              <div className="preview-field">
                <span style={labelStyle}>Semestre</span>
                <span style={valueStyle}>{alumno.semestre || '\u2014'}</span>
              </div>
            </div>
            <div className="preview-field-row">
              <div className="preview-field">
                <span style={labelStyle}>Promedio</span>
                <span style={{ ...valueStyle, fontWeight: 700, color: '#0f172a' }}>
                  {typeof alumno.promedio === 'number' ? alumno.promedio.toFixed(2) : alumno.promedio || '\u2014'}
                </span>
              </div>
              <div className="preview-field">
                <span style={labelStyle}>Créditos cubiertos</span>
                <span style={valueStyle}>{alumno.creditos_cubiertos ?? '\u2014'}</span>
              </div>
              <div className="preview-field">
                <span style={labelStyle}>Estatus</span>
                <span className={`preview-estatus-${(alumno.estatus || '').toLowerCase().replace(/\s+/g, '-')}`}>
                  {alumno.estatus || '\u2014'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR + Photo sidebar area */}
      <div className="preview-sidebar-row">
        {alumno.url_qr && (
          <div className="preview-qr-box">
            <span style={labelStyle}>Código QR</span>
            <img src={alumno.url_qr} alt="QR" className="preview-qr-img" />
          </div>
        )}
      </div>

      {/* Academic History */}
      <div className="preview-section">
        <h3 className="preview-section-title">HISTORIAL ACADÉMICO</h3>
        {hasHistorial ? (
          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Clave</th>
                  <th>Materia</th>
                  <th>Calificación</th>
                  <th>Créditos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h, i) => (
                  <tr key={i}>
                    <td>{h.periodo}</td>
                    <td>{h.clave}</td>
                    <td>{h.materia}</td>
                    <td style={{ textAlign: 'center' }}>{h.calificacion}</td>
                    <td style={{ textAlign: 'center' }}>{h.creditos}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`preview-estado-${(h.estado || '').toLowerCase().replace(/\s+/g, '-')}`}>
                        {h.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem', padding: '1rem 0' }}>
            No se encontraron materias registradas en el historial académico.
          </p>
        )}
      </div>

      {/* Sellos */}
      {Array.isArray(sellos) && sellos.length > 0 && (
        <div className="preview-section">
          <h3 className="preview-section-title">SELLOS INSTITUCIONALES</h3>
          <div className="preview-sellos">
            {sellos.map((s, i) => (
              <div key={i} className="preview-sello-item">
                <div className="preview-sello-icon">
                  <svg viewBox="0 0 140 140" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="70" cy="70" r="64" fill="none" stroke="#1e40af" strokeWidth="2" opacity="0.7" />
                    <circle cx="70" cy="70" r="58" fill="none" stroke="#1e40af" strokeWidth="0.8" opacity="0.4" />
                    <text x="70" y="50" textAnchor="middle" fontSize="10" fontWeight="700" fill="#1e40af" fontFamily="Arial">
                      SIVACAD
                    </text>
                    <text x="70" y="65" textAnchor="middle" fontSize="5" fill="#1e40af" fontFamily="Arial" opacity="0.8">
                      {s.titulo || ''}
                    </text>
                    <text x="70" y="78" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b91c1c" fontFamily="Arial">
                      {'\u25CF'} SIVACAD {'\u25CF'}
                    </text>
                    <text x="70" y="110" textAnchor="middle" fontSize="4" fill="#1e40af" fontFamily="Arial" opacity="0.5">
                      Documento Oficial
                    </text>
                  </svg>
                </div>
                <div className="preview-sello-info">
                  <strong>{s.titulo || s.tipo || '\u2014'}</strong>
                  <span>{s.descripcion || ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Institutional Note */}
      {nota_institucional && (
        <div className="preview-section">
          <div className="preview-nota">
            <p>{nota_institucional}</p>
          </div>
        </div>
      )}

      {/* Firma Electrónica */}
      <div className="preview-section">
        <div className="preview-firma">
          <span style={labelStyle}>Firma Electrónica</span>
          <code className="preview-firma-hash">{firma_electronica || '\u2014'}</code>
        </div>
      </div>

      {/* Footer */}
      <div className="preview-footer">
        <span>Documento generado electrónicamente el {fecha_emision || '\u2014'}</span>
        <span>Folio: {folio || '\u2014'}</span>
        <span>Zona horaria: {zona_horaria || '\u2014'}</span>
        <span>SIVACAD</span>
      </div>

      {/* Export buttons */}
      {(onExportPDF || onExportExcel) && (
        <div className="preview-actions">
          {onExportPDF && (
            <button className="btn primary" onClick={onExportPDF} type="button">
              Descargar PDF
            </button>
          )}
          {onExportExcel && (
            <button className="btn accent" onClick={onExportExcel} type="button">
              Descargar Excel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
