import React from 'react';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  BarChart3,
  CalendarClock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  ArrowLeft
} from 'lucide-react';

function buildQueryString(filters) {
  const params = new URLSearchParams();

  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.alumnoId) params.set('alumnoId', filters.alumnoId);
  if (filters.grupoId) params.set('grupoId', filters.grupoId);

  const query = params.toString();
  return query ? `?${query}` : '?tipo=general';
}

export default function ReportesPage() {
  const { token } = useAuth();

  const [filters, setFilters] = React.useState({
    tipo: 'general',
    alumnoId: '',
    grupoId: ''
  });
  const [loadingType, setLoadingType] = React.useState('');
  const [statusMessage, setStatusMessage] = React.useState('');

  const query = React.useMemo(() => buildQueryString(filters), [filters]);

  const handleDownload = async (type) => {
    try {
      setLoadingType(type);
      setStatusMessage('');

      const blob =
        type === 'pdf'
          ? await api.reportPdf(token, query)
          : await api.reportExcel(token, query);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        type === 'pdf'
          ? 'sivacad-reporte-institucional.pdf'
          : 'sivacad-reporte-institucional.xlsx';

      link.click();
      URL.revokeObjectURL(url);

      setStatusMessage(
        type === 'pdf'
          ? 'PDF institucional generado correctamente.'
          : 'Excel institucional generado correctamente.'
      );
    } catch (error) {
      console.error('Error al descargar reporte:', error);
      setStatusMessage(
        error?.message || 'No fue posible generar el reporte institucional.'
      );
    } finally {
      setLoadingType('');
    }
  };

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">
            <BarChart3 size={16} />
            Reportes institucionales • SIVACAD
          </div>

          <h1>Exportación académica y estadística</h1>

          <p>
            Genera reportes en PDF o Excel con el mismo estilo institucional del sistema:
            encabezado formal, métricas consolidadas y análisis de riesgo académico.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <small>Formato disponible</small>
            <strong>PDF / Excel</strong>
          </div>

          <div className="meta-card">
            <small>Enfoque</small>
            <strong>Institucional</strong>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        <StatCard
          label="Reporte oficial"
          value="SIVACAD"
          hint="Salida uniforme para jurado y control interno"
          icon={FileText}
        />
        <StatCard
          label="Exportación rápida"
          value="2 formatos"
          hint="PDF y Excel con la misma estructura"
          icon={Download}
        />
        <StatCard
          label="Análisis"
          value="Académico"
          hint="Indicadores y seguimiento institucional"
          icon={BarChart3}
        />
        <StatCard
          label="Estado"
          value="Listo"
          hint="Descarga directa con sesión autenticada"
          icon={ShieldCheck}
        />
      </div>

      <div className="two-col">
        <SectionCard
          title="Configurar reporte"
          subtitle="Ajusta el tipo de consulta antes de exportar"
        >
          <div className="form-stack">
            <label className="field">
              <span>Tipo de reporte</span>
              <select
                value={filters.tipo}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, tipo: e.target.value }))
                }
              >
                <option value="general">General</option>
                <option value="alumno">Alumno</option>
                <option value="grupo">Grupo</option>
                <option value="riesgo">Riesgo académico</option>
              </select>
            </label>

            <div className="grid-two">
              <label className="field">
                <span>Alumno ID</span>
                <input
                  value={filters.alumnoId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, alumnoId: e.target.value }))
                  }
                  placeholder="Opcional"
                />
              </label>

              <label className="field">
                <span>Grupo ID</span>
                <input
                  value={filters.grupoId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, grupoId: e.target.value }))
                  }
                  placeholder="Opcional"
                />
              </label>
            </div>

            <div className="row gap wrap">
              <button
                className="btn primary"
                type="button"
                onClick={() => handleDownload('pdf')}
                disabled={loadingType !== ''}
              >
                {loadingType === 'pdf' ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <FileText size={18} />
                )}
                Exportar PDF
              </button>

              <button
                className="btn secondary"
                type="button"
                onClick={() => handleDownload('excel')}
                disabled={loadingType !== ''}
              >
                {loadingType === 'excel' ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <FileSpreadsheet size={18} />
                )}
                Exportar Excel
              </button>
            </div>

            {statusMessage && (
              <div className="note" style={{ marginTop: '0.75rem' }}>
                {statusMessage}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Vista institucional"
          subtitle="El mismo lenguaje visual para ambos reportes"
        >
          <div className="list">
            <div className="list-item">
              <strong>
                <CalendarClock size={16} style={{ marginRight: 6 }} />
                Fecha y hora
              </strong>
              <span>
                El documento se genera con marca temporal institucional para control y
                trazabilidad.
              </span>
            </div>

            <div className="list-item">
              <strong>
                <SlidersHorizontal size={16} style={{ marginRight: 6 }} />
                Encabezado uniforme
              </strong>
              <span>
                Ambos formatos comparten portada, subtítulo, metadatos y bloques de
                interpretación.
              </span>
            </div>

            <div className="list-item">
              <strong>
                <ShieldCheck size={16} style={{ marginRight: 6 }} />
                Uso institucional
              </strong>
              <span>
                Los reportes están pensados para exposición académica, seguimiento interno
                y análisis del sistema.
              </span>
            </div>
          </div>

          <div className="note" style={{ marginTop: '1rem' }}>
            El archivo Excel ahora también conserva un formato formal con hoja de resumen,
            hoja de datos y estructura homogénea con el PDF.
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Sugerencia de uso"
        subtitle="Generación rápida y presentación formal"
      >
        <div className="note">
          Para un reporte general, deja el tipo en “General” y exporta en PDF para
          presentación; usa Excel cuando necesites revisar o compartir los indicadores en
          formato editable.
        </div>
      </SectionCard>

      <button
        type="button"
        className="btn secondary"
        onClick={() => window.history.back()}
        style={{ width: 'fit-content' }}
      >
        <ArrowLeft size={16} />
        Volver
      </button>
    </div>
  );
}