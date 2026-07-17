import React from 'react';
import { ShieldAlert, TrendingDown, Activity, AlertTriangle, Users, FileText } from 'lucide-react';

var LEVEL_COLORS = { Bajo: '#22c55e', Medio: '#eab308', Alto: '#f97316', 'Cr\u00edtico': '#ef4444' };

function toNum(v, f) { var n = Number(v); return Number.isFinite(n) ? n : (f || 0); }

function formatDate() {
  return new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function DesercionPreview({ data }) {
  if (!data) {
    return (
      <div className="text-center py-10 text-gray-400">
        <FileText size={48} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No hay datos disponibles para la vista previa.</p>
      </div>
    );
  }

  var r = data.resumen || {};
  var dist = data.distribucion_riesgo || [];
  var parciales = data.parciales || [];
  var ciclos = data.ciclos || [];
  var porCarrera = data.por_carrera || [];
  var progresion = data.progresion || [];
  var alertas = data.alertas_recientes || [];
  var insights = data.insights || [];
  var porMateria = data.por_materia || [];
  var totalDist = dist.reduce(function(s, d) { return s + toNum(d.total); }, 0);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden print-area">
      {/* Header */}
      <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <img src="/assets/Logo-TecNM.png" alt="TecNM" className="h-10 opacity-80" onError={function(e) { e.target.style.display = 'none'; }} />
        <div className="text-center">
          <h1 className="text-lg font-bold tracking-wide">SIVACAD &mdash; Reporte Estrat\u00e9gico de Riesgo de Deserci\u00f3n</h1>
          <p className="text-xs text-gray-400 mt-1">
            Generado: {formatDate()} &nbsp;|&nbsp; Periodo: <strong className="text-indigo-400">{r.periodo_activo || 'N/D'}</strong>
          </p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-red-900/40 text-red-300 text-xs font-bold rounded border border-red-800">
            CONFIDENCIAL &mdash; Uso Acad\u00e9mico Exclusivo
          </span>
        </div>
        <img src="/assets/Logo-TESI.png" alt="TESI" className="h-10 opacity-80" onError={function(e) { e.target.style.display = 'none'; }} />
      </div>

      <div className="p-6 space-y-6">

        {/* 1. Executive Summary */}
        <section className="print-break-inside-avoid">
          <h2 className="text-base font-bold text-gray-900 border-b-2 border-indigo-600 pb-1 mb-3 flex items-center gap-2">
            <Activity size={18} className="text-indigo-600" /> Resumen Ejecutivo
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            El sistema SIVACAD tiene registrados <strong>{toNum(r.alumnos)}</strong> alumnos,{' '}
            <strong>{toNum(r.docentes)}</strong> docentes y <strong>{toNum(r.grupos)}</strong> grupos.
            Se han generado <strong>{toNum(r.alertas_total)}</strong> alertas de deserci\u00f3n:
            <strong className="text-amber-600"> {toNum(r.alertas_pendientes)}</strong> pendientes y{' '}
            <strong className="text-green-600">{toNum(r.alertas_atendidas)}</strong> atendidas
            (tasa: <strong>{toNum(r.tasa_atencion)}%</strong>).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <MetricCard label="Alertas Totales" value={toNum(r.alertas_total)} color="#4f46e5" />
            <MetricCard label="Pendientes" value={toNum(r.alertas_pendientes)} color="#f97316" />
            <MetricCard label="Atendidas" value={toNum(r.alertas_atendidas)} color="#16a34a" />
            <MetricCard label="Tasa Atenci\u00f3n" value={toNum(r.tasa_atencion) + '%'} color={toNum(r.tasa_atencion) >= 50 ? '#16a34a' : '#dc2626'} />
            <MetricCard label="Alumnos" value={toNum(r.alumnos)} color="#3b82f6" />
            <MetricCard label="Grupos" value={toNum(r.grupos)} color="#8b5cf6" />
          </div>
        </section>

        {/* 2. Risk Distribution */}
        <section className="print-break-inside-avoid">
          <h2 className="text-base font-bold text-gray-900 border-b-2 border-indigo-600 pb-1 mb-3 flex items-center gap-2">
            <TrendingDown size={18} className="text-indigo-600" /> Distribuci\u00f3n de Riesgo Acad\u00e9mico
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            La distribuci\u00f3n de riesgo entre los <strong>{totalDist}</strong> casos analizados muestra
            que el <strong>{totalDist > 0 ? (dist.filter(function(d){return d.nivel==='Cr\u00edtico'||d.nivel==='Alto'}).reduce(function(s,d){return s+toNum(d.total)},0)/totalDist*100).toFixed(1):0}%</strong>
            de los casos se concentra en niveles Alto o Cr\u00edtico.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {dist.map(function(d) {
              return (
                <div key={d.nivel} className="text-center p-2 rounded border" style={{borderColor: (LEVEL_COLORS[d.nivel] || '#64748b') + '30'}}>
                  <div className="text-xs font-semibold" style={{color: LEVEL_COLORS[d.nivel] || '#64748b'}}>{d.nivel}</div>
                  <div className="text-xl font-bold" style={{color: LEVEL_COLORS[d.nivel] || '#64748b'}}>{toNum(d.total)}</div>
                  <div className="text-xs text-gray-400">{totalDist > 0 ? (toNum(d.total)/totalDist*100).toFixed(1) : 0}%</div>
                </div>
              );
            })}
          </div>
          {dist.map(function(d) {
            var pct = totalDist > 0 ? (toNum(d.total) / totalDist * 100) : 0;
            return (
              <div key={'bar-'+d.nivel} className="flex items-center gap-2 mb-1">
                <div className="w-14 text-xs font-medium text-right" style={{color: LEVEL_COLORS[d.nivel]}}>{d.nivel}</div>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{width:pct+'%', background:LEVEL_COLORS[d.nivel]||'#64748b', minWidth:pct>0?'3px':'0'}}></div>
                </div>
                <div className="w-8 text-xs font-bold text-right">{toNum(d.total)}</div>
              </div>
            );
          })}
        </section>

        {/* 3. Parciales */}
        {parciales.length > 0 && (
          <section className="print-break-inside-avoid">
            <h2 className="text-base font-bold text-gray-900 border-b-2 border-indigo-600 pb-1 mb-3 flex items-center gap-2">
              <Activity size={18} className="text-indigo-600" /> An\u00e1lisis por Parciales Acad\u00e9micos
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="p-2 text-left">Parcial</th><th className="p-2 text-center">Promedio</th>
                    <th className="p-2 text-center">Riesgos</th><th className="p-2 text-center">Reprob.</th>
                    <th className="p-2 text-center">Activos</th><th className="p-2 text-center">Desert.</th>
                    <th className="p-2 text-center">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {parciales.map(function(p) {
                    return (
                      <tr key={p.numero_parcial} className="border-b border-gray-100 even:bg-gray-50">
                        <td className="p-2 font-medium">Parcial {p.numero_parcial}</td>
                        <td className="p-2 text-center">{toNum(p.promedio_general)}</td>
                        <td className="p-2 text-center">{toNum(p.total_riesgos)}</td>
                        <td className="p-2 text-center">{toNum(p.total_reprobadas)}</td>
                        <td className="p-2 text-center">{toNum(p.total_activos)}</td>
                        <td className="p-2 text-center">{toNum(p.total_desertores)}</td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{background:LEVEL_COLORS[p.nivel_riesgo]||'#64748b'}}>
                            {toNum(p.tasa_desercion)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. Ciclos */}
        {ciclos.length > 1 && (
          <section className="print-break-inside-avoid">
            <h2 className="text-base font-bold text-gray-900 border-b-2 border-indigo-600 pb-1 mb-3 flex items-center gap-2">
              <TrendingDown size={18} className="text-indigo-600" /> Comparativa por Ciclos
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="p-2 text-left">Ciclo</th><th className="p-2 text-center">Alertas</th>
                    <th className="p-2 text-center">Alto/Cr\u00edtico</th><th className="p-2 text-center">Riesgo Prom.</th>
                    <th className="p-2 text-center">Tasa Deser.</th>
                  </tr>
                </thead>
                <tbody>
                  {ciclos.map(function(c, i) {
                    return (
                      <tr key={i} className="border-b border-gray-100 even:bg-gray-50">
                        <td className="p-2 font-medium">{c.ciclo}</td>
                        <td className="p-2 text-center">{toNum(c.alertas)}</td>
                        <td className="p-2 text-center">{toNum(c.alto_riesgo)}</td>
                        <td className="p-2 text-center">{toNum(c.riesgo_promedio)}</td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{background:LEVEL_COLORS[c.tasa_desercion>=75?'Cr\u00edtico':c.tasa_desercion>=50?'Alto':c.tasa_desercion>=25?'Medio':'Bajo']||'#64748b'}}>
                            {toNum(c.tasa_desercion)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. Insights */}
        {insights.length > 0 && (
          <section className="print-break-inside-avoid">
            <h2 className="text-base font-bold text-gray-900 border-b-2 border-indigo-600 pb-1 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-indigo-600" /> Insights Estrat\u00e9gicos
            </h2>
            <div className="space-y-2">
              {insights.map(function(ins, i) {
                return (
                  <div key={i} className="flex gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                    <div className="flex-shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{ins}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Alertas Recientes */}
        {alertas.length > 0 && (
          <section className="print-break-inside-avoid">
            <h2 className="text-base font-bold text-gray-900 border-b-2 border-indigo-600 pb-1 mb-3 flex items-center gap-2">
              <ShieldAlert size={18} className="text-indigo-600" /> Alertas Recientes
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="p-2 text-center">#</th><th className="p-2 text-left">Matr\u00edcula</th>
                    <th className="p-2 text-left">Alumno</th><th className="p-2 text-center">Riesgo</th>
                    <th className="p-2 text-center">Puntaje</th><th className="p-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map(function(a, i) {
                    return (
                      <tr key={a.id_alerta || i} className="border-b border-gray-100 even:bg-gray-50">
                        <td className="p-2 text-center">{i+1}</td>
                        <td className="p-2">{a.matricula||''}</td>
                        <td className="p-2">{(a.nombres||'')+' '+(a.apellido_paterno||'')+' '+(a.apellido_materno||'')}</td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{background:LEVEL_COLORS[a.nivel_riesgo]||'#64748b'}}>
                            {a.nivel_riesgo||''}
                          </span>
                        </td>
                        <td className="p-2 text-center">{toNum(a.puntaje_riesgo)}</td>
                        <td className="p-2 text-center">
                          {a.atendida
                            ? <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold bg-green-600">Atendida</span>
                            : <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold bg-amber-600">Pendiente</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            <strong>SIVACAD</strong> &mdash; Sistema Integral para la Valoraci\u00f3n del Conocimiento y Aprovechamiento Acad\u00e9mico<br />
            Reporte generado el {formatDate()} &nbsp;|&nbsp; Periodo: {r.periodo_activo || 'N/D'}<br />
            <em className="text-red-400">CONFIDENCIAL &mdash; Uso Acad\u00e9mico Exclusivo</em>
          </p>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="text-center p-2 rounded-lg border border-gray-200 bg-gray-50">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-lg font-bold" style={{color: color || '#1e293b'}}>{value}</div>
    </div>
  );
}
