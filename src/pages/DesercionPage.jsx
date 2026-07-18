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

const LEVEL_COLORS = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', 'Cr\u00edtico': '#ef4444' };

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={function() { navigate(-1); }} className="btn btn-ghost btn-sm">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="text-indigo-600" size={28} />
              IA de Deserci\u00f3n Acad\u00e9mica
            </h1>
            <p className="text-sm text-gray-500">
              Reporte estrat\u00e9gico de riesgo de deserci\u00f3n &middot; Periodo: {r.periodo_activo || 'Cargando...'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} disabled={loading} className="btn btn-outline btn-sm flex items-center gap-1.5">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button onClick={function() { setShowPreview(!showPreview); }} disabled={!data} className="btn btn-outline btn-sm flex items-center gap-1.5">
            <Eye size={15} />
            {showPreview ? 'Ocultar' : 'Vista Previa'}
          </button>
          <button onClick={handleExportPDF} disabled={exportingPDF || !data} className="btn btn-primary btn-sm flex items-center gap-1.5">
            {exportingPDF ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            {exportingPDF ? 'Generando...' : 'PDF'}
          </button>
          <button onClick={handleExportExcel} disabled={exportingExcel || !data} className="btn btn-success btn-sm flex items-center gap-1.5" style={{background:'#16a34a',color:'#fff'}}>
            {exportingExcel ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            {exportingExcel ? 'Generando...' : 'Excel'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error shadow-lg">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={fetchData} className="btn btn-sm">Reintentar</button>
        </div>
      )}

      {loading && !data && (
        <div className="flex justify-center items-center py-20">
          <Loader2 size={40} className="animate-spin text-indigo-600" />
        </div>
      )}

      {!loading && data && !showPreview && (
        <>
          <SectionCard title="Resumen Ejecutivo" icon={Activity}>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              El sistema SIVACAD tiene registrados <strong>{toNum(r.alumnos)}</strong> alumnos,{' '}
              <strong>{toNum(r.docentes)}</strong> docentes y <strong>{toNum(r.grupos)}</strong> grupos.
              Se han generado <strong>{toNum(r.alertas_total)}</strong> alertas de deserci\u00f3n:{' '}
              <strong className="text-amber-600">{toNum(r.alertas_pendientes)}</strong> pendientes y{' '}
              <strong className="text-green-600">{toNum(r.alertas_atendidas)}</strong> atendidas
              (tasa: <strong>{toNum(r.tasa_atencion)}%</strong>).
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Alertas Totales" value={toNum(r.alertas_total)} color="indigo" />
              <StatCard label="Pendientes" value={toNum(r.alertas_pendientes)} color="amber" />
              <StatCard label="Atendidas" value={toNum(r.alertas_atendidas)} color="green" />
              <StatCard label="Tasa Atenci\u00f3n" value={toNum(r.tasa_atencion) + '%'} color={toNum(r.tasa_atencion) >= 50 ? 'green' : 'red'} />
              <StatCard label="Alumnos" value={toNum(r.alumnos)} color="blue" />
              <StatCard label="Grupos" value={toNum(r.grupos)} color="purple" />
            </div>
          </SectionCard>

          <SectionCard title="Distribuci\u00f3n de Riesgo" icon={TrendingDown}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {dist.map(function(d) {
                return (
                  <div key={d.nivel} className="text-center p-3 rounded-lg border" style={{borderColor: LEVEL_COLORS[d.nivel] + '40'}}>
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{d.nivel}</div>
                    <div className="text-2xl font-bold" style={{color: LEVEL_COLORS[d.nivel]}}>{toNum(d.total)}</div>
                    <div className="text-xs text-gray-400">{totalDist > 0 ? (toNum(d.total) / totalDist * 100).toFixed(1) : 0}%</div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              {dist.map(function(d) {
                var pct = totalDist > 0 ? (toNum(d.total) / totalDist * 100) : 0;
                return (
                  <div key={d.nivel} className="flex items-center gap-2">
                    <div className="w-16 text-xs font-medium text-right" style={{color: LEVEL_COLORS[d.nivel]}}>{d.nivel}</div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{width: pct + '%', background: LEVEL_COLORS[d.nivel], minWidth: pct > 0 ? '4px' : '0'}}></div>
                    </div>
                    <div className="w-10 text-xs font-bold text-right">{toNum(d.total)}</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {data.parciales && data.parciales.length > 0 && (
            <SectionCard title="An\u00e1lisis por Parciales" icon={Activity}>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full text-sm">
                  <thead>
                    <tr className="bg-indigo-600 text-white">
                      <th className="text-left">Parcial</th><th>Promedio</th><th>Riesgos</th><th>Reprob.</th><th>Activos</th><th>Desert.</th><th>Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.parciales.map(function(p) {
                      return (
                        <tr key={p.numero_parcial}>
                          <td>Parcial {p.numero_parcial}</td>
                          <td className="text-center">{toNum(p.promedio_general)}</td>
                          <td className="text-center">{toNum(p.total_riesgos)}</td>
                          <td className="text-center">{toNum(p.total_reprobadas)}</td>
                          <td className="text-center">{toNum(p.total_activos)}</td>
                          <td className="text-center">{toNum(p.total_desertores)}</td>
                          <td className="text-center">
                            <span className="badge badge-sm" style={{background: LEVEL_COLORS[p.nivel_riesgo] || '#64748b', color: '#fff'}}>
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
            <SectionCard title="Insights Estrat\u00e9gicos" icon={AlertTriangle}>
              <div className="space-y-3">
                {data.insights.map(function(ins, i) {
                  return (
                    <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex-shrink-0 w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{ins}</p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {data.por_carrera && data.por_carrera.length > 0 && (
            <SectionCard title="An\u00e1lisis por Carrera" icon={Users}>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full text-sm">
                  <thead>
                    <tr className="bg-sky-600 text-white">
                      <th className="text-left">Carrera</th><th>Alertas</th><th>Alto/Cr\u00edtico</th><th>Pendientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.por_carrera.map(function(c, i) {
                      return (
                        <tr key={i}>
                          <td>{c.carrera}</td>
                          <td className="text-center">{toNum(c.total_alertas)}</td>
                          <td className="text-center">{toNum(c.alto_riesgo)}</td>
                          <td className="text-center">{toNum(c.pendientes)}</td>
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
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full text-sm">
                  <thead>
                    <tr className="bg-indigo-600 text-white">
                      <th>#</th><th>Matr\u00edcula</th><th>Alumno</th><th>Riesgo</th><th>Puntaje</th><th>Estado</th><th>Periodo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.alertas_recientes.map(function(a, i) {
                      return (
                        <tr key={a.id_alerta || i}>
                          <td className="text-center">{i + 1}</td>
                          <td>{a.matricula || ''}</td>
                          <td>{(a.nombres || '') + ' ' + (a.apellido_paterno || '') + ' ' + (a.apellido_materno || '')}</td>
                          <td className="text-center">
                            <span className="badge badge-sm" style={{background: LEVEL_COLORS[a.nivel_riesgo] || '#64748b', color: '#fff'}}>
                              {a.nivel_riesgo || ''}
                            </span>
                          </td>
                          <td className="text-center">{toNum(a.puntaje_riesgo)}</td>
                          <td className="text-center">
                            {a.atendida
                              ? <span className="badge badge-sm bg-green-600 text-white">Atendida</span>
                              : <span className="badge badge-sm bg-amber-600 text-white">Pendiente</span>}
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
