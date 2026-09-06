import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reportes } from '../services/reportes';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import DesercionPreview from '../components/DesercionPreview';
import {
  ArrowLeft, RefreshCw, Download, FileText, FileSpreadsheet,
  Loader2, AlertTriangle, ShieldAlert, UserX,
  Users, Activity, TrendingDown, Eye
} from 'lucide-react';

const LEVEL_COLORS = { Bajo: 'var(--success, #22c55e)', Medio: 'var(--warning, #eab308)', Alto: 'var(--color-warning, #f97316)', 'Crítico': 'var(--error, #ef4444)' };

function toNum(v, f) { var n = Number(v); return Number.isFinite(n) ? n : (f || 0); }

export default function DesercionPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await reportes.getDesercionPreview(token);
      setData(resp.data || resp);
    } catch (err) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(function() { fetchData(); }, [fetchData]);

  async function handleExportPDF() {
    setExportingPDF(true);
    try {
      await reportes.downloadDesercionPDF(token);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
    } finally {
      setExportingPDF(false);
    }
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      await reportes.downloadDesercionExcel(token);
    } catch (err) {
      console.error('Error al exportar Excel:', err);
    } finally {
      setExportingExcel(false);
    }
  }

  var r = data?.resumen || {};
  var dist = data?.distribucion_riesgo || [];
  var totalDist = dist.reduce(function(s, d) { return s + toNum(d.total); }, 0);

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={function() { navigate(-1); }} className="btn ghost" style={{ padding: '0.35rem' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <ShieldAlert size={28} style={{ color: 'var(--accent)' }} />
              IA de Deserción Académica
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
              Reporte estratégico de riesgo de deserción · Periodo: {r.periodo_activo || 'Cargando...'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={fetchData} disabled={loading} className="btn outline" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Actualizar
          </button>
          <button onClick={function() { setShowPreview(!showPreview); }} disabled={!data} className="btn outline" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Eye size={15} />
            {showPreview ? 'Ocultar' : 'Vista Previa'}
          </button>
          <button onClick={handleExportPDF} disabled={exportingPDF || !data} className="btn accent" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {exportingPDF ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
            {exportingPDF ? 'Generando...' : 'PDF'}
          </button>
          <button onClick={handleExportExcel} disabled={exportingExcel || !data} className="btn accent" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--success)', color: '#fff' }}>
            {exportingExcel ? <Loader2 size={15} className="spin" /> : <FileSpreadsheet size={15} />}
            {exportingExcel ? 'Generando...' : 'Excel'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert danger">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={fetchData} className="btn outline" style={{ fontSize: '0.85rem' }}>Reintentar</button>
        </div>
      )}

      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5rem 0' }}>
          <Loader2 size={40} className="spin" style={{ color: 'var(--accent)' }} />
        </div>
      )}

      {!loading && data && !showPreview && (
        <>
          <SectionCard title="Resumen Ejecutivo" icon={Activity}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              El sistema SIVACAD tiene registrados <strong>{toNum(r.alumnos)}</strong> alumnos,{' '}
              <strong>{toNum(r.docentes)}</strong> docentes y <strong>{toNum(r.grupos)}</strong> grupos.
              Se han generado <strong>{toNum(r.alertas_total)}</strong> alertas de deserción:{' '}
              <strong style={{ color: 'var(--warning)' }}>{toNum(r.alertas_pendientes)}</strong> pendientes y{' '}
              <strong style={{ color: 'var(--success)' }}>{toNum(r.alertas_atendidas)}</strong> atendidas
              (tasa: <strong>{toNum(r.tasa_atencion)}%</strong>).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <StatCard label="Alertas Totales" value={toNum(r.alertas_total)} color="indigo" />
              <StatCard label="Pendientes" value={toNum(r.alertas_pendientes)} color="amber" />
              <StatCard label="Atendidas" value={toNum(r.alertas_atendidas)} color="green" />
              <StatCard label="Tasa Atención" value={toNum(r.tasa_atencion) + '%'} color={toNum(r.tasa_atencion) >= 50 ? 'green' : 'red'} />
              <StatCard label="Alumnos" value={toNum(r.alumnos)} color="blue" />
              <StatCard label="Grupos" value={toNum(r.grupos)} color="purple" />
            </div>
          </SectionCard>

          <SectionCard title="Distribución de Riesgo" icon={TrendingDown}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {dist.map(function(d) {
                return (
                  <div key={d.nivel} style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${LEVEL_COLORS[d.nivel]}40` }}>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.25rem' }}>{d.nivel}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: LEVEL_COLORS[d.nivel] }}>{toNum(d.total)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{totalDist > 0 ? (toNum(d.total) / totalDist * 100).toFixed(1) : 0}%</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {dist.map(function(d) {
                var pct = totalDist > 0 ? (toNum(d.total) / totalDist * 100) : 0;
                return (
                  <div key={d.nivel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '4rem', fontSize: '0.7rem', fontWeight: 500, textAlign: 'right', color: LEVEL_COLORS[d.nivel] }}>{d.nivel}</div>
                    <div style={{ flex: 1, height: '1rem', background: 'var(--bg-secondary)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '999px', transition: 'all 0.3s', width: pct + '%', background: LEVEL_COLORS[d.nivel], minWidth: pct > 0 ? '4px' : '0' }}></div>
                    </div>
                    <div style={{ width: '2.5rem', fontSize: '0.7rem', fontWeight: 700, textAlign: 'right' }}>{toNum(d.total)}</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {data.parciales && data.parciales.length > 0 && (
            <SectionCard title="Análisis por Parciales" icon={Activity}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Parcial</th><th>Promedio</th><th>Riesgos</th><th>Reprob.</th><th>Activos</th><th>Desert.</th><th>Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.parciales.map(function(p) {
                      return (
                        <tr key={p.numero_parcial}>
                          <td>Parcial {p.numero_parcial}</td>
                          <td style={{ textAlign: 'center' }}>{toNum(p.promedio_general)}</td>
                          <td style={{ textAlign: 'center' }}>{toNum(p.total_riesgos)}</td>
                          <td style={{ textAlign: 'center' }}>{toNum(p.total_reprobadas)}</td>
                          <td style={{ textAlign: 'center' }}>{toNum(p.total_activos)}</td>
                          <td style={{ textAlign: 'center' }}>{toNum(p.total_desertores)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge" style={{ background: LEVEL_COLORS[p.nivel_riesgo] || 'var(--muted)', color: '#fff' }}>
                              {toNum(p.tasa_desercion)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {data.insights && data.insights.length > 0 && (
            <SectionCard title="Insights Estratégicos" icon={AlertTriangle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.insights.map(function(ins, i) {
                  return (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ flexShrink: 0, width: '1.75rem', height: '1.75rem', background: 'var(--accent)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.125rem' }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ins}</p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {data.por_carrera && data.por_carrera.length > 0 && (
            <SectionCard title="Análisis por Carrera" icon={Users}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Carrera</th><th>Alertas</th><th>Alto/Crítico</th><th>Pendientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.por_carrera.map(function(c, i) {
                      return (
                        <tr key={i}>
                          <td>{c.carrera}</td>
                          <td style={{ textAlign: 'center' }}>{toNum(c.total_alertas)}</td>
                          <td style={{ textAlign: 'center' }}>{toNum(c.alto_riesgo)}</td>
                          <td style={{ textAlign: 'center' }}>{toNum(c.pendientes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {data.alertas_recientes && data.alertas_recientes.length > 0 && (
            <SectionCard title="Alertas Recientes" icon={ShieldAlert}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>#</th><th>Matrícula</th><th>Alumno</th><th>Riesgo</th><th>Puntaje</th><th>Estado</th><th>Periodo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alertas_recientes.map(function(a, i) {
                      return (
                        <tr key={a.id_alerta || i}>
                          <td style={{ textAlign: 'center' }}>{i + 1}</td>
                          <td>{a.matricula || ''}</td>
                          <td>{(a.nombres || '') + ' ' + (a.apellido_paterno || '') + ' ' + (a.apellido_materno || '')}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge" style={{ background: LEVEL_COLORS[a.nivel_riesgo] || 'var(--muted)', color: '#fff' }}>
                              {a.nivel_riesgo || ''}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{toNum(a.puntaje_riesgo)}</td>
                          <td style={{ textAlign: 'center' }}>
                            {a.atendida
                              ? <span className="badge success">Atendida</span>
                              : <span className="badge warning">Pendiente</span>}
                          </td>
                          <td>{a.nombre_periodo || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {!loading && data && showPreview && (
        <DesercionPreview data={data} />
      )}
    </div>
  );
}
