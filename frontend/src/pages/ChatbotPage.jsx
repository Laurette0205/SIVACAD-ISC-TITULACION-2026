import React from 'react';
import { useNavigate } from 'react-router-dom';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Loader2, SendHorizonal, BarChart3, Shield, Settings,
  MessageSquareText, AlertTriangle, Download, RefreshCw,
  CheckCircle2, XCircle, Clock, TrendingUp, Users,
  FileText, Activity, Bot, Bug, Search, Filter, Save,
  GraduationCap, CalendarRange, BookOpen, ListChecks,
  LineChart, Eye, Bell, ClipboardList, User, ExternalLink,
  Wrench, Server, KeyRound, ScrollText, Route
} from 'lucide-react';

function normalizeRole(value) {
  return String(value || '').trim().toUpperCase();
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      className={`btn ${active ? 'accent' : 'secondary'}`}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function ChatPanel({ token, role }) {
  const welcomeMsg = role === 'COORDINADOR'
    ? 'Hola, soy el ChatBot Institucional. Puedo ayudarte con la supervision academica: consultar grupos, revisar estados academicos, identificar alertas, solicitar reportes y orientar procesos institucionales por periodo y grupo.'
    : role === 'DOCENTE'
    ? 'Hola, soy el ChatBot Institucional. Puedo ayudarte con informacion de tus grupos: alumnos por grupo, ausencias justificadas, riesgo de desercion, inscripciones a actividades, becas, servicio social, residencias, creditos, titulacion y mas. Solo preguntame directamente.'
    : role === 'SOPORTE'
    ? 'Hola, soy el ChatBot de Soporte. Puedo ayudarte a diagnosticar fallas tecnicas, atender incidencias, revisar errores del backend, validar sesiones de usuarios, orientar recuperacion de acceso y resolver problemas tecnicos del sistema.'
    : role === 'ALUMNO'
    ? 'Hola, soy el ChatBot Institucional del TESI. Puedo ayudarte con orientacion sobre tus tramites academicos: consultar que docentes tienes este semestre, fechas de evaluaciones, requisitos de inscripcion y reinscripcion, procedimientos de titulacion, horarios de servicios escolares, creditos, becas al extranjero, servicio social, residencias profesionales y mas. Tambien puedo indicarte la plataforma oficial de Control Escolar. Solo preguntame directamente.'
    : 'Hola, soy el asistente institucional de SIVACAD. Puedo ayudarte con modulos, usuarios, reportes, seguridad y actividad general del sistema.';
  const [messages, setMessages] = React.useState([
    { role: 'bot', text: welcomeMsg }
  ]);
  const [texto, setTexto] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const endRef = React.useRef(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const userText = texto.trim();
    if (!userText || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setTexto('');
    setLoading(true);
    try {
      const response = await api.chatbotMensaje(token, userText);
      const reply = response?.respuesta || response?.data?.respuesta || response?.message || 'Respuesta generada.';
      setMessages((prev) => [...prev, { role: 'bot', text: reply }]);
      if (response?.warning) {
        setMessages((prev) => [...prev, { role: 'bot', text: `[Modo offline: ${response.warning}]`, mode: 'warn' }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'bot', text: error?.message || 'No pude conectar con el backend del chatbot.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await api.chatbotLimpiar(token);
      setMessages([{ role: 'bot', text: welcomeMsg }]);
    } catch (err) {
      console.error('Error al limpiar:', err);
    }
  };

  return (
    <SectionCard
      title="ChatBot Institucional"
      subtitle={role === 'COORDINADOR' ? 'Respuestas contextualizadas por periodo, grupo y estado academico' : role === 'DOCENTE' ? 'Respuestas breves, concisas, detalladas y orientadas a la accion' : role === 'SOPORTE' ? 'Diagnostico de fallas, atencion de incidencias y resolucion de problemas tecnicos' : role === 'ALUMNO' ? 'Orientacion academica, tramites, docentes y servicios escolares' : 'Consulta estrategica amplia y supervision transversal del sistema'}
      right={
        <button type="button" className="btn secondary" onClick={handleClear}>
          <RefreshCw size={14} /> Limpiar
        </button>
      }
    >
      <div className="chat-box" style={{ minHeight: '420px', maxHeight: '480px', overflowY: 'auto' }}>
        {messages.map((msg, index) => (
          <div key={index} className={`bubble ${msg.role === 'user' ? 'user' : 'bot'}`}
            style={msg.mode === 'warn' ? { opacity: 0.7, fontSize: '0.85rem' } : {}}>
            {msg.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={handleSend} style={{ marginTop: '0.75rem' }}>
        <input
          type="text" value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder={role === 'ADMINISTRADOR' || role === 'COORDINADOR'
            ? 'Consulta el estado general, incidencias, accesos, flujos del sistema...'
            : role === 'DOCENTE'
            ? 'Ej: Cuantos alumnos hay en el grupo 1101? ...'
            : role === 'SOPORTE'
            ? 'Ej: Cuantas incidencias abiertas hay?, diagnosticar falla en login, errores del backend...'
            : role === 'ALUMNO'
            ? 'Ej: Que docente imparte Programacion Orientada a Objetos?, requisitos de inscripcion?, procedimiento de titulacion?...'
            : 'Escribe tu pregunta sobre SIVACAD...'}
          disabled={loading}
        />
        <button className="btn accent" type="submit" disabled={loading || !texto.trim()}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <SendHorizonal size={18} />}
          Enviar
        </button>
      </form>
    </SectionCard>
  );
}

function PanelGeneral({ token, user }) {
  const role = normalizeRole(user?.rol_nombre || user?.rol || user?.role);
  const navigate = useNavigate();
  const [metricas, setMetricas] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (role === 'ADMINISTRADOR' || role === 'COORDINADOR' || role === 'DOCENTE') {
      api.chatbotMetricas(token).then((res) => {
        setMetricas(res?.data || res || null);
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, role]);

  const acciones = [
    { icon: Activity, label: 'Consultar estado general', desc: 'Visión general del sistema', roles: ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO', 'SOPORTE'] },
    { icon: Bug, label: 'Revisar incidencias', desc: 'Reportes y seguimiento de incidencias', roles: ['ADMINISTRADOR', 'COORDINADOR', 'SOPORTE'] },
    { icon: Search, label: 'Validar accesos', desc: 'Verificar sesiones y permisos activos', roles: ['ADMINISTRADOR', 'COORDINADOR'] },
    { icon: Bot, label: 'Orientar flujos del sistema', desc: 'Guiar sobre procesos academicos', roles: ['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'ALUMNO', 'SOPORTE'] },
    { icon: Users, label: 'Supervisar modulos', desc: 'Monitoreo de modulos activos', roles: ['ADMINISTRADOR', 'COORDINADOR'] },
    { icon: Download, label: 'Exportaciones', desc: 'Exportar datos y reportes', roles: ['ADMINISTRADOR', 'COORDINADOR'] }
  ];

  const accionesFiltradas = acciones.filter((a) => a.roles.includes(role));

  return (
    <div className="stack">
      <SectionCard title="Panel General" subtitle="Apoyar la toma de decisiones, centralizar consultas y reforzar la administracion del entorno institucional">
        <div className="status-list">
          <div className="status ok">
            <CheckCircle2 size={18} />
            Sistema SIVACAD operativo. Cobertura total sobre modulos, usuarios, reportes, seguridad y actividad general.
          </div>
          <div className="status ok">
            <Shield size={18} />
            {role === 'ADMINISTRADOR' ? 'Permisos: Consulta estrategica amplia, supervision transversal y acceso a informacion consolidada.'
              : role === 'COORDINADOR' ? 'Permisos: Supervision transversal y acceso a informacion consolidada.'
              : role === 'ALUMNO' ? 'Acceso a ChatBot institucional, consultas y orientacion de flujos del sistema.'
              : 'Acceso a modulo de consulta y soporte del sistema.'}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Acciones disponibles" subtitle="Integrar respuestas ejecutivas, validacion por rol y sugerencias de accion inmediata">
        <div className="quick-grid">
          {accionesFiltradas.map(({ icon: Icon, label, desc }) => (
            <button key={label} type="button" className="quick-item" style={{ cursor: 'default' }}>
              <div className="quick-left">
                <div className="quick-icon"><Icon size={18} /></div>
                <div><strong>{label}</strong><span>{desc}</span></div>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      {(role === 'ADMINISTRADOR' || role === 'COORDINADOR' || role === 'DOCENTE') && (
        <SectionCard title="Metricas rapidas" subtitle="Indicadores de actividad del chatbot">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 className="animate-spin" size={18} /> Cargando metricas...
            </div>
          ) : metricas ? (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <div className="stat-card">
                <Activity size={20} />
                <div className="stat-value">{metricas.hoy ?? '—'}</div>
                <div className="stat-label">Hoy</div>
              </div>
              <div className="stat-card">
                <BarChart3 size={20} />
                <div className="stat-value">{metricas.total_30d ?? '—'}</div>
                <div className="stat-label">Ultimos 30 dias</div>
              </div>
              <div className="stat-card">
                <Clock size={20} />
                <div className="stat-value">{metricas.tiempo_promedio_ms ? `${(metricas.tiempo_promedio_ms / 1000).toFixed(1)}s` : '—'}</div>
                <div className="stat-label">Tiempo promedio</div>
              </div>
              <div className="stat-card" style={metricas.incidencias_abiertas > 0 ? { borderColor: '#ef4444' } : {}}>
                <AlertTriangle size={20} />
                <div className="stat-value">{metricas.incidencias_abiertas ?? '—'}</div>
                <div className="stat-label">Incidencias abiertas</div>
              </div>
            </div>
          ) : (
            <div className="auth-note">No se pudieron cargar las metricas.</div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Beneficio institucional" subtitle="Optimiza el control institucional, reduce tiempos de supervision y fortalece la gobernanza tecnologica">
        <div className="status-list">
          <div className="status ok">
            <TrendingUp size={18} />
            Centraliza consultas y refuerza la administracion del entorno institucional.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function MetricasGlobales({ token, role }) {
  const [metricas, setMetricas] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    api.chatbotMetricas(token).then((res) => {
      setMetricas(res?.data || res || null);
    }).catch((err) => {
      setError(err?.message || 'Error al cargar metricas');
    }).finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <SectionCard title="Metricas Globales" subtitle="Analitica del chatbot institucional">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando metricas...
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Metricas Globales" subtitle="Analitica del chatbot institucional">
        <div className="alert error">{error}</div>
      </SectionCard>
    );
  }

  if (!metricas) {
    return (
      <SectionCard title="Metricas Globales" subtitle="Analitica del chatbot institucional">
        <div className="auth-note">No hay datos disponibles.</div>
      </SectionCard>
    );
  }

  return (
    <div className="stack">
      <SectionCard title="Metricas Globales" subtitle="Analitica del chatbot institucional">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <div className="stat-card">
            <MessageSquareText size={22} />
            <div className="stat-value">{metricas.total_30d ?? 0}</div>
            <div className="stat-label">Consultas (30d)</div>
          </div>
          <div className="stat-card">
            <Activity size={22} />
            <div className="stat-value">{metricas.hoy ?? 0}</div>
            <div className="stat-label">Consultas hoy</div>
          </div>
          <div className="stat-card">
            <Clock size={22} />
            <div className="stat-value">{metricas.tiempo_promedio_ms ? `${(metricas.tiempo_promedio_ms / 1000).toFixed(1)}s` : '—'}</div>
            <div className="stat-label">Tiempo promedio</div>
          </div>
          <div className="stat-card" style={metricas.incidencias_abiertas > 0 ? { borderColor: '#ef4444' } : {}}>
            <AlertTriangle size={22} />
            <div className="stat-value">{metricas.incidencias_abiertas ?? 0}</div>
            <div className="stat-label">Incidencias abiertas</div>
          </div>
        </div>
      </SectionCard>

      {metricas.modo_stats && metricas.modo_stats.length > 0 && (
        <SectionCard title="Distribucion por modo de respuesta" subtitle="Ultimos 7 dias">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {metricas.modo_stats.map((item, i) => (
              <div key={i} className="stat-card" style={{ minWidth: 120 }}>
                <div className="stat-value">{item.total}</div>
                <div className="stat-label">{item.modo_respuesta}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {metricas.rol_stats && metricas.rol_stats.length > 0 && (
        <SectionCard title="Consultas por rol" subtitle="Ultimos 7 dias">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {metricas.rol_stats.map((item, i) => (
              <div key={i} className="stat-card" style={{ minWidth: 120 }}>
                <div className="stat-value">{item.total}</div>
                <div className="stat-label">{item.rol_usuario}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {metricas.top_usuarios && metricas.top_usuarios.length > 0 && (
        <SectionCard title="Usuarios mas activos" subtitle="Ultimos 7 dias">
          <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>ID Usuario</th>
                <th style={{ padding: '0.5rem' }}>Rol</th>
                <th style={{ padding: '0.5rem' }}>Consultas</th>
              </tr>
            </thead>
            <tbody>
              {metricas.top_usuarios.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.5rem' }}>{item.id_usuario}</td>
                  <td style={{ padding: '0.5rem' }}>{item.rol_usuario}</td>
                  <td style={{ padding: '0.5rem' }}>{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </SectionCard>
      )}
    </div>
  );
}

function AuditoriaPanel({ token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [total, setTotal] = React.useState(0);
  const [filtro, setFiltro] = React.useState('');

  const loadAuditoria = React.useCallback(async (accion) => {
    try {
      setLoading(true);
      setError('');
      const params = accion ? `?accion=${encodeURIComponent(accion)}` : '';
      const res = await api.chatbotAuditoria(token, params);
      setRows(res?.data || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(err?.message || 'Error al cargar auditoria');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    loadAuditoria();
  }, [loadAuditoria]);

  const handleFilter = () => {
    loadAuditoria(filtro.trim() || undefined);
  };

  return (
    <SectionCard
      title="Auditoria del ChatBot"
      subtitle="Registro de actividades y cambios en el sistema"
      right={
        <button type="button" className="btn secondary" onClick={async () => {
          try {
            const res = await api.chatbotExportar(token, 'auditoria');
            const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `chatbot_auditoria_${new Date().toISOString().split('T')[0]}.json`;
            a.click(); URL.revokeObjectURL(url);
          } catch(e) { console.error('Export error:', e); }
        }}>
          <Download size={14} /> Exportar
        </button>
      }
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          type="text" placeholder="Filtrar por accion..." value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn secondary" onClick={handleFilter}>
          <Filter size={14} /> Filtrar
        </button>
        {filtro && (
          <button type="button" className="btn secondary" onClick={() => { setFiltro(''); loadAuditoria(); }}>
            <XCircle size={14} /> Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando auditoria...
        </div>
      ) : error ? (
        <div className="alert error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="auth-note">No se encontraron registros de auditoria.</div>
      ) : (
        <>
          <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Total: {total} registros</div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Fecha</th>
                  <th style={{ padding: '0.4rem' }}>Usuario</th>
                  <th style={{ padding: '0.4rem' }}>Rol</th>
                  <th style={{ padding: '0.4rem' }}>Accion</th>
                  <th style={{ padding: '0.4rem' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id_auditoria || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>
                      {new Date(row.created_at).toLocaleString('es-MX')}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{row.id_usuario}</td>
                    <td style={{ padding: '0.4rem' }}>{row.rol_usuario}</td>
                    <td style={{ padding: '0.4rem' }}><code>{row.accion}</code></td>
                    <td style={{ padding: '0.4rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.detalle || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function ConfiguracionPanel({ token, user }) {
  const [config, setConfig] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [editando, setEditando] = React.useState(null);
  const [valorEdit, setValorEdit] = React.useState('');
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    api.chatbotConfiguracion(token).then((res) => {
      setConfig(res?.data || []);
    }).catch((err) => {
      setError(err?.message || 'Error al cargar configuracion');
    }).finally(() => setLoading(false));
  }, [token]);

  const handleSave = async (clave) => {
    try {
      setMsg('');
      await api.chatbotActualizarConfig(token, clave, valorEdit);
      setMsg('Configuracion actualizada correctamente.');
      setEditando(null);
      const res = await api.chatbotConfiguracion(token);
      setConfig(res?.data || []);
    } catch (err) {
      setMsg('Error: ' + (err?.message || 'No se pudo actualizar'));
    }
  };

  if (loading) {
    return (
      <SectionCard title="Configuracion del Sistema" subtitle="Ajustes del chatbot institucional">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando configuracion...
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Configuracion del Sistema" subtitle="Ajustes del chatbot institucional">
      {error && <div className="alert error">{error}</div>}
      {msg && <div className="alert success">{msg}</div>}

      {config.length === 0 && !error && (
        <div className="auth-note">No hay configuraciones disponibles.</div>
      )}

      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Clave</th>
              <th style={{ padding: '0.5rem' }}>Valor</th>
              <th style={{ padding: '0.5rem' }}>Descripcion</th>
              <th style={{ padding: '0.5rem' }}>Accion</th>
            </tr>
          </thead>
          <tbody>
            {config.map((item) => (
              <tr key={item.id_config} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '0.5rem' }}><code>{item.clave}</code></td>
                <td style={{ padding: '0.5rem' }}>
                  {editando === item.clave ? (
                    <input
                      type="text" value={valorEdit}
                      onChange={(e) => setValorEdit(e.target.value)}
                      style={{ width: '100%' }}
                      autoFocus
                    />
                  ) : (
                    <span style={{ fontWeight: 500 }}>{item.valor}</span>
                  )}
                </td>
                <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>{item.descripcion}</td>
                <td style={{ padding: '0.5rem' }}>
                  {editando === item.clave ? (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button type="button" className="btn accent" onClick={() => handleSave(item.clave)}>
                        <CheckCircle2 size={14} /> Guardar
                      </button>
                      <button type="button" className="btn secondary" onClick={() => setEditando(null)}>
                        <XCircle size={14} /> Cancelar
                      </button>
                    </div>
                  ) : (
                    item.editable ? (
                      <button type="button" className="btn secondary" onClick={() => { setEditando(item.clave); setValorEdit(item.valor); }}>
                        <Settings size={14} /> Editar
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: '0.85rem' }}>Fijo</span>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </SectionCard>
  );
}

function IncidenciasPanel({ token, role }) {
  const [rows, setRows] = React.useState([]);
  const [resumen, setResumen] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [filtroEstado, setFiltroEstado] = React.useState('');
  const [editId, setEditId] = React.useState(null);
  const [editEstado, setEditEstado] = React.useState('');
  const [editPrioridad, setEditPrioridad] = React.useState('');
  const [editSolucion, setEditSolucion] = React.useState('');
  const [msg, setMsg] = React.useState('');

  const isAdmin = role === 'ADMINISTRADOR' || role === 'COORDINADOR';

  const loadIncidencias = React.useCallback(async (estado) => {
    try {
      setLoading(true);
      setError('');
      let params = '';
      if (estado) params += `?estado=${encodeURIComponent(estado)}`;
      const res = await api.chatbotIncidencias(token, params);
      setRows(res?.data || []);
      setResumen(res?.resumen || []);
    } catch (err) {
      setError(err?.message || 'Error al cargar incidencias');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => { loadIncidencias(); }, [loadIncidencias]);

  const handleUpdate = async (id) => {
    try {
      setMsg('');
      const body = {};
      if (editEstado) body.estado = editEstado;
      if (editPrioridad) body.prioridad = editPrioridad;
      if (editSolucion.trim()) body.solucion = editSolucion.trim();
      await api.chatbotActualizarIncidencia(token, id, body);
      setMsg('Incidencia actualizada correctamente.');
      setEditId(null);
      setEditEstado(''); setEditPrioridad(''); setEditSolucion('');
      loadIncidencias(filtroEstado || undefined);
    } catch (err) {
      setMsg('Error: ' + (err?.message || 'No se pudo actualizar'));
    }
  };

  return (
    <SectionCard
      title="Incidencias del ChatBot"
      subtitle="Reportes y seguimiento de incidencias del sistema"
      right={
        <button type="button" className="btn secondary" onClick={async () => {
          try {
            const res = await api.chatbotExportar(token, 'incidencias');
            const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `chatbot_incidencias_${new Date().toISOString().split('T')[0]}.json`;
            a.click(); URL.revokeObjectURL(url);
          } catch(e) { console.error('Export error:', e); }
        }}>
          <Download size={14} /> Exportar
        </button>
      }
    >
      {msg && <div className="alert success" style={{ marginBottom: '0.75rem' }}>{msg}</div>}

      {resumen.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {resumen.map((item, i) => (
            <button
              key={i} type="button"
              className={`btn ${filtroEstado === item.estado ? 'accent' : 'secondary'}`}
              onClick={() => {
                if (filtroEstado === item.estado) { setFiltroEstado(''); loadIncidencias(); }
                else { setFiltroEstado(item.estado); loadIncidencias(item.estado); }
              }}
            >
              {item.estado}: {item.total}
            </button>
          ))}
          {filtroEstado && (
            <button type="button" className="btn secondary" onClick={() => { setFiltroEstado(''); loadIncidencias(); }}>
              <XCircle size={14} /> Limpiar filtro
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando incidencias...
        </div>
      ) : error ? (
        <div className="alert error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="auth-note">No hay incidencias registradas.</div>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '0.4rem' }}>Fecha</th>
                <th style={{ padding: '0.4rem' }}>Usuario</th>
                <th style={{ padding: '0.4rem' }}>Categoria</th>
                <th style={{ padding: '0.4rem' }}>Prioridad</th>
                <th style={{ padding: '0.4rem' }}>Estado</th>
                <th style={{ padding: '0.4rem' }}>Descripcion</th>
                {isAdmin && <th style={{ padding: '0.4rem' }}>Accion</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id_incidencia || i} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>
                    {new Date(row.created_at).toLocaleString('es-MX')}
                  </td>
                  <td style={{ padding: '0.4rem' }}>{row.id_usuario}</td>
                  <td style={{ padding: '0.4rem' }}>{row.categoria}</td>
                  <td style={{ padding: '0.4rem' }}>
                    {editId === row.id_incidencia ? (
                      <select value={editPrioridad} onChange={(e) => setEditPrioridad(e.target.value)}
                        style={{ padding: '0.2rem', fontSize: '0.85rem' }}>
                        <option value="">Actual</option>
                        <option value="BAJA">Baja</option>
                        <option value="MEDIA">Media</option>
                        <option value="ALTA">Alta</option>
                        <option value="CRITICA">Critica</option>
                      </select>
                    ) : (
                      <span style={{
                        color: row.prioridad === 'CRITICA' ? '#ef4444' : row.prioridad === 'ALTA' ? '#f97316' : row.prioridad === 'MEDIA' ? '#eab308' : '#22c55e',
                        fontWeight: 600
                      }}>{row.prioridad}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.4rem' }}>
                    {editId === row.id_incidencia ? (
                      <select value={editEstado} onChange={(e) => setEditEstado(e.target.value)}
                        style={{ padding: '0.2rem', fontSize: '0.85rem' }}>
                        <option value="">Actual</option>
                        <option value="ABIERTA">Abierta</option>
                        <option value="EN_REVISION">En revision</option>
                        <option value="RESUELTA">Resuelta</option>
                        <option value="CERRADA">Cerrada</option>
                      </select>
                    ) : (
                      <span>{row.estado}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.4rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {editId === row.id_incidencia ? (
                      <input type="text" value={editSolucion}
                        onChange={(e) => setEditSolucion(e.target.value)}
                        placeholder="Solucion..." style={{ width: '100%', fontSize: '0.85rem' }} />
                    ) : (
                      row.descripcion
                    )}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '0.4rem' }}>
                      {editId === row.id_incidencia ? (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button type="button" className="btn accent" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleUpdate(row.id_incidencia)}>
                            <Save size={12} /> Ok
                          </button>
                          <button type="button" className="btn secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => setEditId(null)}>
                            <XCircle size={12} /> Cancelar
                          </button>
                        </div>
                      ) : (
                        <button type="button" className="btn secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => { setEditId(row.id_incidencia); setEditEstado(''); setEditPrioridad(''); setEditSolucion(row.solucion || ''); }}>
                          <Settings size={12} /> Gestionar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </SectionCard>
  );
}

function ConversacionesPanel({ token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [usuarioFiltro, setUsuarioFiltro] = React.useState('');

  const loadConversaciones = React.useCallback(async (userId) => {
    try {
      setLoading(true);
      setError('');
      let params = '';
      if (userId) params += `?id_usuario=${encodeURIComponent(userId)}`;
      const res = await api.chatbotConversaciones(token, params);
      setRows(res?.data || []);
    } catch (err) {
      setError(err?.message || 'Error al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => { loadConversaciones(); }, [loadConversaciones]);

  return (
    <SectionCard
      title="Conversaciones del ChatBot"
      subtitle="Historial completo de interacciones - Supervision transversal"
      right={
        <button type="button" className="btn secondary" onClick={async () => {
          try {
            const res = await api.chatbotExportar(token, 'conversaciones');
            const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `chatbot_conversaciones_${new Date().toISOString().split('T')[0]}.json`;
            a.click(); URL.revokeObjectURL(url);
          } catch(e) { console.error('Export error:', e); }
        }}>
          <Download size={14} /> Exportar todo
        </button>
      }
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input type="text" placeholder="Filtrar por ID de usuario..." value={usuarioFiltro}
          onChange={(e) => setUsuarioFiltro(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadConversaciones(usuarioFiltro.trim() || undefined)}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn secondary" onClick={() => loadConversaciones(usuarioFiltro.trim() || undefined)}>
          <Search size={14} /> Buscar
        </button>
        {usuarioFiltro && (
          <button type="button" className="btn secondary" onClick={() => { setUsuarioFiltro(''); loadConversaciones(); }}>
            <XCircle size={14} /> Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando conversaciones...
        </div>
      ) : error ? (
        <div className="alert error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="auth-note">No hay conversaciones registradas.</div>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                <th style={{ padding: '0.4rem' }}>Fecha</th>
                <th style={{ padding: '0.4rem' }}>Usuario</th>
                <th style={{ padding: '0.4rem' }}>Nombre</th>
                <th style={{ padding: '0.4rem' }}>Rol</th>
                <th style={{ padding: '0.4rem' }}>Modo</th>
                <th style={{ padding: '0.4rem' }}>Mensaje</th>
                <th style={{ padding: '0.4rem' }}>Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id_mensaje || i} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>
                    {new Date(row.created_at).toLocaleString('es-MX')}
                  </td>
                  <td style={{ padding: '0.4rem' }}>{row.id_usuario}</td>
                  <td style={{ padding: '0.4rem' }}>{row.nombre_completo || '—'}</td>
                  <td style={{ padding: '0.4rem' }}>{row.rol_usuario}</td>
                  <td style={{ padding: '0.4rem' }}>{row.modo_respuesta}</td>
                  <td style={{ padding: '0.4rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.mensaje}
                  </td>
                  <td style={{ padding: '0.4rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.respuesta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </SectionCard>
  );
}

function PanelAcademico({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    api.asistente.coordDashboard(token).then((res) => {
      setData(res?.data || res || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Panel Academico" subtitle="Facilitar la supervision academica y la intervencion oportuna en procesos institucionales">
        <div className="status-list">
          <div className="status ok">
            <CheckCircle2 size={18} />
            Alcance sobre grupos, alumnos, periodos, evaluaciones y estados de riesgo.
          </div>
          <div className="status ok">
            <GraduationCap size={18} />
            Permisos: Consulta y gestion academica parcial enfocada a seguimiento escolar.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando panel academico...
        </div>
      ) : data?.dashboard ? (
        <SectionCard title="Resumen academico" subtitle="Indicadores del periodo activo">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/coordinador/inscripciones')}>
              <GraduationCap size={22} />
              <div className="stat-value">{data.dashboard.total_inscritos ?? data.dashboard.alumnos ?? '—'}</div>
              <div className="stat-label">Alumnos</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/grupos')}>
              <BookOpen size={22} />
              <div className="stat-value">{data.groups?.length ?? data.dashboard.grupos ?? '—'}</div>
              <div className="stat-label">Grupos</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/periodos')}>
              <CalendarRange size={22} />
              <div className="stat-value">{data.dashboard.periodo_activo?.nombre || data.dashboard.periodo || '—'}</div>
              <div className="stat-label">Periodo activo</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer', borderColor: (data.dashboard.alertas || 0) > 0 ? '#ef4444' : undefined }} onClick={() => navigate('/app/coordinador/kardex')}>
              <AlertTriangle size={22} />
              <div className="stat-value">{data.dashboard.alertas ?? data.dashboard.riesgo_alto ?? 0}</div>
              <div className="stat-label">Alertas</div>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Resumen academico" subtitle="Indicadores del periodo activo">
          <div className="auth-note">No se pudieron cargar los datos academicos.</div>
        </SectionCard>
      )}

      <SectionCard title="Acciones del coordinador" subtitle="Consultar grupos, revisar estados academicos, identificar alertas, solicitar reportes y orientar procesos">
        <div className="quick-grid">
          <button type="button" className="quick-item" onClick={() => navigate('/app/grupos')}>
            <div className="quick-left">
              <div className="quick-icon"><BookOpen size={18} /></div>
              <div><strong>Consultar grupos</strong><span>Ver grupos y su composicion</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/coordinador/kardex')}>
            <div className="quick-left">
              <div className="quick-icon"><FileText size={18} /></div>
              <div><strong>Revisar estados academicos</strong><span>Kardex y seguimiento de alumnos</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/ia')}>
            <div className="quick-left">
              <div className="quick-icon"><AlertTriangle size={18} /></div>
              <div><strong>Identificar alertas</strong><span>IA de desercion y riesgo academico</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/reportes')}>
            <div className="quick-left">
              <div className="quick-icon"><BarChart3 size={18} /></div>
              <div><strong>Solicitar reportes</strong><span>Reportes academicos y estadisticas</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/coordinador/inscripciones')}>
            <div className="quick-left">
              <div className="quick-icon"><ClipboardList size={18} /></div>
              <div><strong>Orientar procesos</strong><span>Inscripciones y reinscripciones</span></div>
            </div>
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Beneficio institucional" subtitle="Mejora el seguimiento academico y la deteccion temprana de problematicas escolares">
        <div className="status-list">
          <div className="status ok">
            <TrendingUp size={18} />
            Facilita la supervision academica y la intervencion oportuna en procesos institucionales.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function PeriodosPanel({ token }) {
  const [periodos, setPeriodos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.coordPeriods(token).then((res) => {
      setPeriodos(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <SectionCard title="Periodos Academicos" subtitle="Gestion y consulta de periodos">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando periodos...
        </div>
      ) : periodos.length === 0 ? (
        <div className="auth-note">No hay periodos registrados.</div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {periodos.map((p, i) => (
            <div key={p.id_periodo || i} className="stat-card" style={{ minWidth: 180, cursor: 'pointer' }}
              onClick={() => window.location.href = '/app/periodos'}>
              <CalendarRange size={22} />
              <div className="stat-value">{p.nombre || p.periodo || '—'}</div>
              <div className="stat-label">{p.estado === 'ACTIVO' ? 'Activo' : p.estado || '—'}</div>
              {p.fecha_inicio && <div className="stat-label" style={{ fontSize: '0.8rem' }}>{p.fecha_inicio} al {p.fecha_fin || '—'}</div>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function GruposPanel({ token }) {
  const [grupos, setGrupos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.coordGroups(token).then((res) => {
      setGrupos(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <SectionCard title="Grupos" subtitle="Consulta de grupos academicos">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando grupos...
        </div>
      ) : grupos.length === 0 ? (
        <div className="auth-note">No hay grupos registrados para este periodo.</div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {grupos.map((g, i) => (
            <div key={g.id_grupo || i} className="stat-card" style={{ minWidth: 200, cursor: 'pointer' }}
              onClick={() => window.location.href = '/app/grupos'}>
              <BookOpen size={22} />
              <div className="stat-value">{g.nombre_grupo || g.grupo || '—'}</div>
              <div className="stat-label">{g.carrera || g.nombre_carrera || '—'} | Semestre {g.semestre || '—'}</div>
              {g.total_alumnos !== undefined && <div className="stat-label">{g.total_alumnos} alumnos</div>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function ReportesPanel({ token }) {
  const navigate = useNavigate();

  const reportes = [
    { label: 'Reporte de grupo', desc: 'Estadisticas por grupo academico', path: '/app/reportes', icon: BarChart3 },
    { label: 'Kardex academico', desc: 'Historial academico de alumnos', path: '/app/coordinador/kardex', icon: FileText },
    { label: 'Alertas de riesgo', desc: 'IA de desercion y riesgo academico', path: '/app/ia', icon: AlertTriangle },
    { label: 'Inscripciones', desc: 'Reporte de inscripciones del periodo', path: '/app/coordinador/inscripciones', icon: ClipboardList },
    { label: 'Evaluaciones', desc: 'Resultados de evaluaciones', path: '/app/evaluaciones', icon: LineChart },
    { label: 'Exportar datos', desc: 'Exportacion de informacion academica', path: '/app/reportes', icon: Download }
  ];

  return (
    <SectionCard title="Reportes Academicos" subtitle="Solicitar reportes y estadisticas del sistema">
      <div className="quick-grid">
        {reportes.map((r, i) => (
          <button key={i} type="button" className="quick-item" onClick={() => navigate(r.path)}>
            <div className="quick-left">
              <div className="quick-icon"><r.icon size={18} /></div>
              <div><strong>{r.label}</strong><span>{r.desc}</span></div>
            </div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

function SeguimientoPanel({ token }) {
  const [tracking, setTracking] = React.useState([]);
  const [alertas, setAlertas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filtro, setFiltro] = React.useState('');

  React.useEffect(() => {
    Promise.all([
      api.asistente.coordTracking(token).catch(() => ({ data: [] })),
      api.asistente.coordAlerts(token).catch(() => ({ data: [] }))
    ]).then(([trackRes, alertRes]) => {
      setTracking(trackRes?.data || []);
      setAlertas(alertRes?.data || []);
    }).finally(() => setLoading(false));
  }, [token]);

  const filteredTracking = filtro
    ? tracking.filter((t) =>
        String(t.nombre || t.alumno || '').toLowerCase().includes(filtro.toLowerCase()) ||
        String(t.matricula || '').includes(filtro))
    : tracking;

  const alertasCount = alertas.length;

  return (
    <div className="stack">
      <SectionCard title="Seguimiento Academico" subtitle="Monitoreo de alumnos y deteccion temprana de problematicas">
        <div className="status-list">
          <div className="status ok">
            <Eye size={18} />
            Seguimiento de estados academicos, alertas de riesgo e intervencion oportuna.
          </div>
          {alertasCount > 0 && (
            <div className="status warn">
              <Bell size={18} />
              {alertasCount} alerta(s) de riesgo academico detectada(s). Revise la seccion de IA de desercion.
            </div>
          )}
        </div>
      </SectionCard>

      {alertas.length > 0 && (
        <SectionCard title="Alertas de riesgo" subtitle="Alertas activas de desercion y riesgo academico">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {alertas.slice(0, 5).map((a, i) => (
              <div key={a.id_alerta || i} className="stat-card" style={{
                minWidth: 200,
                borderColor: a.nivel === 'CRITICO' || a.nivel === 'ALTO' ? '#ef4444' : a.nivel === 'MEDIO' ? '#eab308' : undefined
              }}>
                <AlertTriangle size={18} />
                <div className="stat-label" style={{ fontWeight: 600, marginTop: '0.25rem' }}>
                  {a.nombre_alumno || a.alumno || `ID: ${a.id_alumno}`}
                </div>
                <div className="stat-label" style={{ fontSize: '0.85rem' }}>
                  Nivel: {a.nivel || a.estado_riesgo || '—'} | {a.matricula || '—'}
                </div>
              </div>
            ))}
            {alertasCount > 5 && (
              <div className="auth-note" style={{ width: '100%' }}>
                ...y {alertasCount - 5} alerta(s) mas. Ver todas en IA de desercion.
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Seguimiento de alumnos" subtitle="Busqueda y consulta de estados academicos">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <input type="text" placeholder="Buscar por nombre o matricula..." value={filtro}
            onChange={(e) => setFiltro(e.target.value)} style={{ flex: 1 }} />
          {filtro && (
            <button type="button" className="btn secondary" onClick={() => setFiltro('')}>
              <XCircle size={14} /> Limpiar
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 className="animate-spin" size={18} /> Cargando seguimiento...
          </div>
        ) : filteredTracking.length === 0 ? (
          <div className="auth-note">
            {filtro ? 'No se encontraron alumnos con ese criterio.' : 'No hay datos de seguimiento disponibles.'}
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Matricula</th>
                  <th style={{ padding: '0.4rem' }}>Nombre</th>
                  <th style={{ padding: '0.4rem' }}>Grupo</th>
                  <th style={{ padding: '0.4rem' }}>Estado</th>
                  <th style={{ padding: '0.4rem' }}>Promedio</th>
                </tr>
              </thead>
              <tbody>
                {filteredTracking.map((t, i) => (
                  <tr key={t.id_alumno || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem' }}>{t.matricula || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{t.nombre || t.alumno || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{t.grupo || t.nombre_grupo || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <span style={{
                        color: t.estatus === 'ACTIVO' || t.estado === 'REGULAR' ? '#22c55e'
                          : t.estatus === 'RIESGO' || t.estado_riesgo === 'ALTO' || t.estado_riesgo === 'CRITICO' ? '#ef4444'
                          : t.estatus === 'BAJA' ? '#64748b' : undefined,
                        fontWeight: 600
                      }}>
                        {t.estatus || t.estado || t.estado_riesgo || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem' }}>{t.promedio || t.promedio_general || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function PanelDocente({ token, user }) {
  const navigate = useNavigate();
  const fullName = user?.nombres
    ? `${user.nombres} ${user.apellido_paterno || ''} ${user.apellido_materno || ''}`.replace(/\s+/g, ' ').trim()
    : user?.nombre_completo || 'Docente';

  return (
    <div className="stack">
      <SectionCard title="Panel Docente" subtitle="Brindar apoyo pedagogico, operativo y consultivo al personal docente">
        <div className="status-list">
          <div className="status ok">
            <GraduationCap size={18} />
            Bienvenido, {fullName}. Acceso limitado a sus grupos y funciones pedagogicas asignadas.
          </div>
          <div className="status ok">
            <Eye size={18} />
            Cobertura sobre materias, grupos, alumnos vinculados y actividades evaluativas.
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Acciones del docente" subtitle="Consultar alumnos, revisar evaluaciones, identificar riesgo, resolver dudas operativas, revisar kardex y estados">
        <div className="quick-grid">
          <button type="button" className="quick-item" onClick={() => navigate('/app/docente/inscripciones')}>
            <div className="quick-left">
              <div className="quick-icon"><BookOpen size={18} /></div>
              <div><strong>Consultar alumnos</strong><span>Ver alumnos de sus grupos</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/docente-evaluaciones')}>
            <div className="quick-left">
              <div className="quick-icon"><LineChart size={18} /></div>
              <div><strong>Revisar evaluaciones</strong><span>Evaluaciones y resultados</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/docente/ia')}>
            <div className="quick-left">
              <div className="quick-icon"><AlertTriangle size={18} /></div>
              <div><strong>Identificar riesgo</strong><span>IA de desercion - Riesgo academico</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/docente/kardex')}>
            <div className="quick-left">
              <div className="quick-icon"><FileText size={18} /></div>
              <div><strong>Revisar kardex</strong><span>Historial academico de alumnos</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/asistente/docente')}>
            <div className="quick-left">
              <div className="quick-icon"><Bot size={18} /></div>
              <div><strong>Resolver dudas operativas</strong><span>Asistente academico docente</span></div>
            </div>
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Consultas disponibles en el ChatBot" subtitle="Puede preguntar directamente en la pestana ChatBot Institucional">
        <div className="auth-note">
          <strong>Ejemplos de consultas que puede hacer:</strong>
        </div>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 1.8 }}>
          <li>Cuantos alumnos hay en el grupo [nombre]?</li>
          <li>Que alumno falto a clase pero notifico al coordinador?</li>
          <li>Cuantas alumnas embarazadas hay en cada grupo?</li>
          <li>Hay alumnos con riesgo de desercion academica y por que?</li>
          <li>Cuantos alumnos se inscribieron en Hackaton, InnovaTecNM o TesiChallenge?</li>
          <li>Cuantos alumnos se inscribieron a programas de becas?</li>
          <li>Cuantos alumnos haran servicio social o residencias en empresas con convenio TESI?</li>
          <li>Cuantos alumnos tienen creditos academicos, culturales y deportivos completos?</li>
          <li>Cuantos alumnos deben 2das oportunidades, materias especiales o recurses?</li>
          <li>Cuantos alumnos son aptos para titularse (promedio, residencia, CENEVAL, tesis, proyecto)?</li>
          <li>Cuantos alumnos son aptos para beca al extranjero (ingles 5 niveles)?</li>
        </ul>
      </SectionCard>

      <SectionCard title="Beneficio institucional" subtitle="Fortalece la atencion academica y mejora la comprension de procesos pedagogicos">
        <div className="status-list">
          <div className="status ok">
            <TrendingUp size={18} />
            Fortalece la atencion academica y mejora la comprension de procesos pedagogicos mediante respuestas claras y orientadas a la accion.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function GruposAsignadosPanel({ token }) {
  const [grupos, setGrupos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    api.asistente.docGroups(token).then((res) => {
      setGrupos(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <SectionCard title="Grupos Asignados" subtitle="Grupos bajo su responsabilidad docente">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando grupos...
        </div>
      ) : grupos.length === 0 ? (
        <div className="auth-note">No hay grupos asignados para el periodo actual.</div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {grupos.map((g, i) => (
            <div key={g.id_grupo || i} className="stat-card" style={{ minWidth: 200, cursor: 'pointer' }}
              onClick={() => navigate('/app/docente/inscripciones')}>
              <BookOpen size={22} />
              <div className="stat-value">{g.nombre_grupo || g.grupo || '—'}</div>
              <div className="stat-label">{g.nombre_materia || g.materia || '—'}</div>
              <div className="stat-label">Semestre {g.semestre || '—'} | {g.turno || '—'}</div>
              {g.total_alumnos !== undefined && <div className="stat-label">{g.total_alumnos} alumnos</div>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function EvaluacionesDocentePanel({ token }) {
  const [evaluaciones, setEvaluaciones] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    api.asistente.docEvaluations(token).then((res) => {
      setEvaluaciones(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <SectionCard title="Evaluaciones" subtitle="Actividades evaluativas de sus grupos">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 className="animate-spin" size={18} /> Cargando evaluaciones...
        </div>
      ) : evaluaciones.length === 0 ? (
        <div className="auth-note">No hay evaluaciones registradas para sus grupos.</div>
      ) : (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {evaluaciones.map((e, i) => (
            <div key={e.id_evaluacion || i} className="stat-card" style={{ minWidth: 200, cursor: 'pointer' }}
              onClick={() => navigate('/app/docente-evaluaciones')}>
              <LineChart size={22} />
              <div className="stat-value">{e.nombre_evaluacion || e.titulo || '—'}</div>
              <div className="stat-label">{e.nombre_grupo || e.grupo || '—'} | {e.tipo || '—'}</div>
              <div className="stat-label">{e.estado || '—'} | {e.total_alumnos || 0} alumnos</div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function SeguimientoAcademicoDocente({ token }) {
  const [tracking, setTracking] = React.useState([]);
  const [alertas, setAlertas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filtro, setFiltro] = React.useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    Promise.all([
      api.asistente.docTracking(token).catch(() => ({ data: [] })),
      api.asistente.docAlerts(token).catch(() => ({ data: [] }))
    ]).then(([trackRes, alertRes]) => {
      setTracking(trackRes?.data || []);
      setAlertas(alertRes?.data || []);
    }).finally(() => setLoading(false));
  }, [token]);

  const filtered = filtro
    ? tracking.filter((t) =>
        String(t.nombre || t.alumno || '').toLowerCase().includes(filtro.toLowerCase()) ||
        String(t.matricula || '').includes(filtro))
    : tracking;

  return (
    <div className="stack">
      <SectionCard title="Seguimiento Academico" subtitle="Monitoreo de alumnos y deteccion temprana - Respuestas breves, concisas y orientadas a la accion">
        <div className="status-list">
          <div className="status ok">
            <Eye size={18} />
            Seguimiento de estados academicos, alertas de riesgo y consulta de kardex.
          </div>
          {alertas.length > 0 && (
            <div className="status warn">
              <Bell size={18} />
              {alertas.length} alerta(s) de riesgo academico. Revise la seccion IA de desercion.
            </div>
          )}
        </div>
      </SectionCard>

      {alertas.length > 0 && (
        <SectionCard title="Alertas de riesgo activas" subtitle="Alumnos con riesgo de desercion">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {alertas.slice(0, 5).map((a, i) => (
              <div key={a.id_alerta || i} className="stat-card" style={{
                minWidth: 200,
                borderColor: a.nivel === 'CRITICO' || a.nivel === 'ALTO' ? '#ef4444' : a.nivel === 'MEDIO' ? '#eab308' : undefined
              }}>
                <AlertTriangle size={18} />
                <div className="stat-label" style={{ fontWeight: 600, marginTop: '0.25rem' }}>
                  {a.nombre_alumno || a.alumno || `ID: ${a.id_alumno}`}
                </div>
                <div className="stat-label" style={{ fontSize: '0.85rem' }}>
                  Nivel: {a.nivel || a.estado_riesgo || '—'} | {a.matricula || '—'}
                </div>
              </div>
            ))}
            {alertas.length > 5 && (
              <div className="auth-note" style={{ width: '100%' }}>
                ...y {alertas.length - 5} alerta(s) mas.
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Alumnos" subtitle="Busqueda y consulta de estados">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <input type="text" placeholder="Buscar por nombre o matricula..." value={filtro}
            onChange={(e) => setFiltro(e.target.value)} style={{ flex: 1 }} />
          {filtro && (
            <button type="button" className="btn secondary" onClick={() => setFiltro('')}>
              <XCircle size={14} /> Limpiar
            </button>
          )}
          <button type="button" className="btn secondary" onClick={() => navigate('/app/docente/kardex')}>
            <FileText size={14} /> Ver kardex
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 className="animate-spin" size={18} /> Cargando seguimiento...
          </div>
        ) : filtered.length === 0 ? (
          <div className="auth-note">{filtro ? 'No se encontraron alumnos.' : 'No hay datos disponibles.'}</div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Matricula</th>
                  <th style={{ padding: '0.4rem' }}>Nombre</th>
                  <th style={{ padding: '0.4rem' }}>Grupo</th>
                  <th style={{ padding: '0.4rem' }}>Estado</th>
                  <th style={{ padding: '0.4rem' }}>Promedio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id_alumno || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem' }}>{t.matricula || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{t.nombre || t.alumno || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{t.grupo || t.nombre_grupo || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <span style={{
                        color: t.estatus === 'ACTIVO' || t.estado === 'REGULAR' ? '#22c55e' : '#ef4444',
                        fontWeight: 600
                      }}>{t.estatus || t.estado || '—'}</span>
                    </td>
                    <td style={{ padding: '0.4rem' }}>{t.promedio || t.promedio_general || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function PanelPersonalAlumno({ token, user, onNavigateTab }) {
  const navigate = useNavigate();
  const fullName = user?.nombres
    ? `${user.apellido_paterno || ''} ${user.apellido_materno || ''} ${user.nombres}`.replace(/\s+/g, ' ').trim()
    : user?.nombre_completo || 'Alumno';
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.alumDashboard(token).then((res) => {
      setData(res?.data || res || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Panel Personal" subtitle="Ofrecer autoservicio academico con orientacion clara y sencilla">
        <div className="status-list">
          <div className="status ok">
            <User size={18} />
            Bienvenido, {fullName}. Acceso a consulta de informacion propia y funciones personales autorizadas.
          </div>
          <div className="status ok">
            <Eye size={18} />
            Enfoque sobre tramites, historial academico, evaluaciones y consultas frecuentes.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando informacion...
        </div>
      ) : data ? (
        <SectionCard title="Resumen academico" subtitle="Informacion general del periodo">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/alumno/kardex')}>
              <FileText size={22} />
              <div className="stat-value">{data.promedio_general ?? data.promedio ?? '—'}</div>
              <div className="stat-label">Promedio general</div>
            </div>
            <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/alumno/kardex')}>
              <BookOpen size={22} />
              <div className="stat-value">{data.creditos ?? data.creditos_acumulados ?? '—'}</div>
              <div className="stat-label">Creditos</div>
            </div>
            <div className="stat-card">
              <CalendarRange size={22} />
              <div className="stat-value">{data.semestre ?? data.semestre_actual ?? '—'}</div>
              <div className="stat-label">Semestre</div>
            </div>
            <div className="stat-card" style={data.adeudos > 0 ? { borderColor: '#ef4444' } : {}}>
              <AlertTriangle size={22} />
              <div className="stat-value">{data.adeudos ?? 0}</div>
              <div className="stat-label">Adeudos</div>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Resumen academico" subtitle="Informacion general del periodo">
          <div className="auth-note">No se pudieron cargar los datos academicos.</div>
        </SectionCard>
      )}

      <SectionCard title="Acciones disponibles" subtitle="Consultar informacion personal, resolver dudas, identificar tramites y revisar situacion academica">
        <div className="quick-grid">
          <button type="button" className="quick-item" onClick={() => onNavigateTab('kardex-individual')}>
            <div className="quick-left">
              <div className="quick-icon"><FileText size={18} /></div>
              <div><strong>Kardex individual</strong><span>Historial academico completo</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => onNavigateTab('inscripciones')}>
            <div className="quick-left">
              <div className="quick-icon"><ClipboardList size={18} /></div>
              <div><strong>Inscripciones</strong><span>Informacion de inscripcion</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => onNavigateTab('reinscripciones')}>
            <div className="quick-left">
              <div className="quick-icon"><RefreshCw size={18} /></div>
              <div><strong>Reinscripciones</strong><span>Proceso de reinscripcion</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => onNavigateTab('evaluaciones')}>
            <div className="quick-left">
              <div className="quick-icon"><LineChart size={18} /></div>
              <div><strong>Evaluaciones</strong><span>Calificaciones y resultados</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => onNavigateTab('chatbot')}>
            <div className="quick-left">
              <div className="quick-icon"><Bot size={18} /></div>
              <div><strong>ChatBot Institucional</strong><span>Resolver dudas y consultas</span></div>
            </div>
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Informacion de contacto" subtitle="Instancias a las que puede acudir">
        <div className="auth-note">
          <strong>Control Escolar:</strong> Instalaciones del TESI, edificio G, planta baja. Horario: 9:00 a 15:00 y 16:00 a 18:00 hrs.<br />
          <strong>Plataforma oficial:</strong> <a href="https://sigaa.tesi.org.mx/index.php" target="_blank" rel="noopener noreferrer">https://sigaa.tesi.org.mx/index.php</a><br />
          <strong>Coordinacion de carrera:</strong> Acudir a la oficina de la División de Ingenieria en Sistemas Computacionales.
        </div>
      </SectionCard>

      <SectionCard title="Beneficio institucional" subtitle="Reduce errores de consulta, mejora la autonomia del estudiante y agiliza la atencion">
        <div className="status-list">
          <div className="status ok">
            <TrendingUp size={18} />
            Ofrece autoservicio academico con orientacion clara y sencilla para reducir errores de consulta, mejorar la autonomia del estudiante y agilizar la atencion.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function KardexIndividualAlumno({ token }) {
  const [kardex, setKardex] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.alumKardex(token).then((res) => {
      setKardex(res?.data || res || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Kardex Individual" subtitle="Historial academico completo - Consulta de informacion propia">
        <div className="status-list">
          <div className="status ok">
            <FileText size={18} />
            Acceso a su historial academico, materias cursadas, calificaciones y creditos acumulados.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando kardex...
        </div>
      ) : kardex ? (
        <>
          <SectionCard title="Resumen del kardex" subtitle="Datos generales">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
              <div className="stat-card">
                <FileText size={22} />
                <div className="stat-value">{kardex.promedio_general ?? kardex.promedio ?? '—'}</div>
                <div className="stat-label">Promedio general</div>
              </div>
              <div className="stat-card">
                <BookOpen size={22} />
                <div className="stat-value">{kardex.creditos_acumulados ?? kardex.creditos ?? '—'}</div>
                <div className="stat-label">Creditos acumulados</div>
              </div>
              <div className="stat-card">
                <GraduationCap size={22} />
                <div className="stat-value">{kardex.estatus ?? 'Vigente'}</div>
                <div className="stat-label">Estatus</div>
              </div>
            </div>
          </SectionCard>

          {kardex.materias && kardex.materias.length > 0 && (
            <SectionCard title="Materias cursadas" subtitle="Historial de materias y calificaciones">
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem' }}>Materia</th>
                      <th style={{ padding: '0.4rem' }}>Calificacion</th>
                      <th style={{ padding: '0.4rem' }}>Creditos</th>
                      <th style={{ padding: '0.4rem' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardex.materias.map((m, i) => (
                      <tr key={m.id_materia || i} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '0.4rem' }}>{m.nombre_materia || '—'}</td>
                        <td style={{ padding: '0.4rem' }}>{m.calificacion ?? m.calificacion_final ?? '—'}</td>
                        <td style={{ padding: '0.4rem' }}>{m.creditos ?? '—'}</td>
                        <td style={{ padding: '0.4rem' }}>
                          <span style={{ color: (m.calificacion ?? m.calificacion_final ?? 0) >= 70 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                            {(m.calificacion ?? m.calificacion_final ?? 0) >= 70 ? 'Aprobado' : 'Reprobado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            </SectionCard>
          )}
        </>
      ) : (
        <SectionCard title="Kardex" subtitle="Historial academico">
          <div className="auth-note">No se pudo cargar la informacion del kardex.</div>
        </SectionCard>
      )}

      <SectionCard title="Plataforma oficial" subtitle="Control Escolar">
        <div className="auth-note">
          Para informacion adicional, consulte la plataforma oficial de Control Escolar del TESI:<br />
          <a href="https://sigaa.tesi.org.mx/index.php" target="_blank" rel="noopener noreferrer">https://sigaa.tesi.org.mx/index.php</a>
        </div>
      </SectionCard>
    </div>
  );
}

function InscripcionesAlumno({ token }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.alumInscripciones(token).then((res) => {
      setData(res?.data || res || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Inscripciones" subtitle="Informacion sobre su inscripcion academica">
        <div className="status-list">
          <div className="status ok">
            <ClipboardList size={18} />
            Consulta de informacion propia sobre su inscripcion y estado academico actual.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando informacion de inscripcion...
        </div>
      ) : data ? (
        <SectionCard title="Datos de inscripcion" subtitle="Periodo actual">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div className="stat-card">
              <CalendarRange size={22} />
              <div className="stat-value">{data.periodo ?? data.nombre_periodo ?? '—'}</div>
              <div className="stat-label">Periodo</div>
            </div>
            <div className="stat-card">
              <BookOpen size={22} />
              <div className="stat-value">{data.grupo ?? data.nombre_grupo ?? '—'}</div>
              <div className="stat-label">Grupo</div>
            </div>
            <div className="stat-card">
              <GraduationCap size={22} />
              <div className="stat-value">{data.semestre ?? data.semestre_actual ?? '—'}</div>
              <div className="stat-label">Semestre</div>
            </div>
            <div className="stat-card" style={data.estatus === 'ACTIVO' ? { borderColor: '#22c55e' } : { borderColor: '#ef4444' }}>
              <CheckCircle2 size={22} />
              <div className="stat-value">{data.estatus ?? data.estado ?? '—'}</div>
              <div className="stat-label">Estatus</div>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Datos de inscripcion" subtitle="Periodo actual">
          <div className="auth-note">No se pudo cargar la informacion de inscripcion.</div>
        </SectionCard>
      )}

      <SectionCard title="Requisitos generales" subtitle="Documentacion para inscripcion">
        <div className="auth-note">
          <strong>Documentos necesarios:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 1.8 }}>
            <li>Acta de nacimiento (original y copia)</li>
            <li>Certificado de estudios previos</li>
            <li>CURP (copia)</li>
            <li>Comprobante de domicilio</li>
            <li>Fotografias tamano infantil</li>
            <li>Identificacion oficial</li>
          </ul>
          Para tramites presenciales, acuda a Control Escolar del TESI en horario de atencion.
        </div>
      </SectionCard>
    </div>
  );
}

function ReinscripcionesAlumno({ token }) {
  const navigate = useNavigate();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.alumInscripciones(token).then((res) => {
      setData(res?.data || res || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Reinscripciones" subtitle="Proceso de reinscripcion academica">
        <div className="status-list">
          <div className="status ok">
            <RefreshCw size={18} />
            Informacion sobre el proceso de reinscripcion, requisitos y pasos a seguir.
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Pasos para la reinscripcion" subtitle="Siga estos pasos para realizar su reinscripcion">
        <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 2.2 }}>
          <li>Verifique su kardex academico y asegurese de no tener adeudos de materias.</li>
          <li>Genere y pague su orden de reinscripcion en caja del TESI.</li>
          <li>Acuda a Control Escolar con su comprobante de pago y documentos.</li>
          <li>Seleccione las materias a cursar en el nuevo periodo.</li>
          <li>Confirme su inscripcion y verifique sus horarios.</li>
          <li>Consulte la plataforma SIGAA para ver su carga academica final.</li>
        </ol>
      </SectionCard>

      <SectionCard title="Documentos requeridos" subtitle="Para reinscripcion">
        <div className="auth-note">
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 1.8 }}>
            <li>Kardex o historial academico actualizado</li>
            <li>Comprobante de pago de reinscripcion</li>
            <li>Formato de reinscripcion llenado</li>
            <li>Identificacion oficial vigente</li>
            <li>Correo institucional activo</li>
          </ul>
          Para mas informacion, acuda a Control Escolar o consulte <a href="https://sigaa.tesi.org.mx/index.php" target="_blank" rel="noopener noreferrer">SIGAA</a>.
        </div>
      </SectionCard>

      <SectionCard title="Accion rapida" subtitle="Ir a modulo de reinscripcion">
        <button type="button" className="btn accent" onClick={() => navigate('/app/alumno/reinscripciones')}>
          Ir a modulo de reinscripciones
        </button>
      </SectionCard>
    </div>
  );
}

function EvaluacionesAlumno({ token }) {
  const [evaluaciones, setEvaluaciones] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    api.asistente.alumEvaluaciones(token).then((res) => {
      setEvaluaciones(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Evaluaciones" subtitle="Calificaciones y resultados academicos">
        <div className="status-list">
          <div className="status ok">
            <LineChart size={18} />
            Consulta de evaluaciones, calificaciones por materia y resultados academicos.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando evaluaciones...
        </div>
      ) : evaluaciones.length > 0 ? (
        <SectionCard title="Resultados de evaluaciones" subtitle="Calificaciones del periodo">
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Materia</th>
                  <th style={{ padding: '0.4rem' }}>Tipo</th>
                  <th style={{ padding: '0.4rem' }}>Calificacion</th>
                  <th style={{ padding: '0.4rem' }}>Estado</th>
                  <th style={{ padding: '0.4rem' }}>Periodo</th>
                </tr>
              </thead>
              <tbody>
                {evaluaciones.map((e, i) => (
                  <tr key={e.id_evaluacion || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem' }}>{e.nombre_materia || e.materia || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{e.tipo_evaluacion || e.tipo || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <span style={{ color: (e.calificacion ?? e.calificacion_final ?? 0) >= 70 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                        {e.calificacion ?? e.calificacion_final ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      {(e.calificacion ?? e.calificacion_final ?? 0) >= 70 ? 'Aprobado' : 'Reprobado'}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{e.periodo || e.nombre_periodo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Resultados de evaluaciones" subtitle="Calificaciones del periodo">
          <div className="auth-note">No hay evaluaciones registradas o no se pudieron cargar.</div>
        </SectionCard>
      )}
    </div>
  );
}

function PanelTecnicoSoporte({ token, user }) {
  const navigate = useNavigate();
  const fullName = user?.nombres
    ? `${user.apellido_paterno || ''} ${user.apellido_materno || ''} ${user.nombres}`.replace(/\s+/g, ' ').trim()
    : user?.nombre_completo || 'Soporte';
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.sopDashboard(token).then((res) => {
      setData(res?.data || res || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Panel Tecnico" subtitle="Mantener la continuidad operativa y apoyar la resolucion de incidencias">
        <div className="status-list">
          <div className="status ok">
            <Wrench size={18} />
            Bienvenido, {fullName}. Acceso tecnico de diagnostico, sin control academico de fondo.
          </div>
          <div className="status ok">
            <Server size={18} />
            Cobertura sobre autenticacion, errores del backend, fallos de navegacion y reportes tecnicos.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando informacion del sistema...
        </div>
      ) : data ? (
        <SectionCard title="Estado del sistema" subtitle="Indicadores tecnicos actuales">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <div className="stat-card" style={data.incidencias_abiertas > 0 ? { borderColor: '#ef4444' } : {}}>
              <AlertTriangle size={22} />
              <div className="stat-value">{data.incidencias_abiertas ?? '—'}</div>
              <div className="stat-label">Incidencias abiertas</div>
            </div>
            <div className="stat-card">
              <Users size={22} />
              <div className="stat-value">{data.sesiones_activas ?? data.sesiones ?? '—'}</div>
              <div className="stat-label">Sesiones activas</div>
            </div>
            <div className="stat-card">
              <KeyRound size={22} />
              <div className="stat-value">{data.resets_pendientes ?? data.password_resets ?? '—'}</div>
              <div className="stat-label">Resets de password</div>
            </div>
            <div className="stat-card">
              <Activity size={22} />
              <div className="stat-value">{data.actividad_hoy ?? data.bitacora_hoy ?? '—'}</div>
              <div className="stat-label">Actividad hoy</div>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Estado del sistema" subtitle="Indicadores tecnicos actuales">
          <div className="auth-note">No se pudieron cargar los datos del sistema.</div>
        </SectionCard>
      )}

      <SectionCard title="Acciones de soporte" subtitle="Diagnosticar fallas, atender incidencias, revisar errores, validar sesiones, orientar recuperacion y resolver problemas tecnicos">
        <div className="quick-grid">
          <button type="button" className="quick-item" onClick={() => navigate('/app/soporte/incidencias')}>
            <div className="quick-left">
              <div className="quick-icon"><AlertTriangle size={18} /></div>
              <div><strong>Atender incidencias</strong><span>Revisar y dar seguimiento</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/soporte/usuarios')}>
            <div className="quick-left">
              <div className="quick-icon"><Users size={18} /></div>
              <div><strong>Validar sesiones</strong><span>Usuarios y sesiones activas</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/soporte/usuarios')}>
            <div className="quick-left">
              <div className="quick-icon"><KeyRound size={18} /></div>
              <div><strong>Recuperacion de acceso</strong><span>Restablecer contrasenas</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/soporte/logs')}>
            <div className="quick-left">
              <div className="quick-icon"><ScrollText size={18} /></div>
              <div><strong>Bitacora del sistema</strong><span>Logs y actividad</span></div>
            </div>
          </button>
          <button type="button" className="quick-item" onClick={() => navigate('/app/soporte/incidencias')}>
            <div className="quick-left">
              <div className="quick-icon"><Route size={18} /></div>
              <div><strong>Validar rutas</strong><span>Problemas de navegacion</span></div>
            </div>
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Objetivo funcional" subtitle="Disminuye tiempos de respuesta, mejora la estabilidad tecnica y fortalece la disponibilidad del sistema">
        <div className="status-list">
          <div className="status ok">
            <TrendingUp size={18} />
            Mantener la continuidad operativa, disminuir tiempos de respuesta, mejorar la estabilidad tecnica y fortalecer la disponibilidad del sistema.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function IncidenciasSoportePanel({ token }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.sopIncidencias(token).then((res) => {
      setRows(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Incidencias del Sistema" subtitle="Gestion y seguimiento de incidencias tecnicas">
        <div className="status-list">
          <div className="status ok">
            <AlertTriangle size={18} />
            Revision de incidencias, reportes tecnicos y seguimiento de resolucion de fallos.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando incidencias...
        </div>
      ) : rows.length > 0 ? (
        <SectionCard title="Incidencias registradas" subtitle="Lista de incidencias del sistema">
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Fecha</th>
                  <th style={{ padding: '0.4rem' }}>Categoria</th>
                  <th style={{ padding: '0.4rem' }}>Prioridad</th>
                  <th style={{ padding: '0.4rem' }}>Estado</th>
                  <th style={{ padding: '0.4rem' }}>Descripcion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id_incidencia || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleString('es-MX')}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{r.categoria || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <span style={{ fontWeight: 600, color: r.prioridad === 'CRITICA' ? '#ef4444' : r.prioridad === 'ALTA' ? '#f97316' : r.prioridad === 'MEDIA' ? '#eab308' : '#22c55e' }}>
                        {r.prioridad || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem' }}>{r.estado || '—'}</td>
                    <td style={{ padding: '0.4rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.descripcion || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Incidencias" subtitle="Incidencias del sistema">
          <div className="auth-note">No hay incidencias registradas o no se pudieron cargar.</div>
        </SectionCard>
      )}

      <SectionCard title="Accion rapida" subtitle="Ir a modulo de incidencias">
        <button type="button" className="btn accent" onClick={() => window.location.href = '/app/soporte/incidencias'}>
          Ir a modulo de incidencias
        </button>
      </SectionCard>
    </div>
  );
}

function RecuperacionAccesoSoporte({ token }) {
  const [resets, setResets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.sopResets(token).then((res) => {
      setResets(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Recuperacion de Acceso" subtitle="Orientar recuperacion de acceso y restablecimiento de contrasenas">
        <div className="status-list">
          <div className="status ok">
            <KeyRound size={18} />
            Gestion de solicitudes de restablecimiento de contrasena y recuperacion de acceso al sistema.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando solicitudes...
        </div>
      ) : resets.length > 0 ? (
        <SectionCard title="Solicitudes de restablecimiento" subtitle="Solicitudes de recuperacion de contrasena">
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>ID Usuario</th>
                  <th style={{ padding: '0.4rem' }}>Token</th>
                  <th style={{ padding: '0.4rem' }}>Expira</th>
                  <th style={{ padding: '0.4rem' }}>Usado</th>
                </tr>
              </thead>
              <tbody>
                {resets.map((r, i) => (
                  <tr key={r.id_reseteo || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem' }}>{r.id_usuario}</td>
                    <td style={{ padding: '0.4rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.token}</td>
                    <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>{new Date(r.expires_at).toLocaleString('es-MX')}</td>
                    <td style={{ padding: '0.4rem' }}>{r.used ? 'Si' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Solicitudes de restablecimiento" subtitle="No hay solicitudes pendientes">
          <div className="auth-note">No hay solicitudes de restablecimiento de contrasena activas.</div>
        </SectionCard>
      )}

      <SectionCard title="Procedimiento" subtitle="Pasos para recuperacion de acceso">
        <div className="auth-note">
          <strong>Pasos para restablecer una contrasena:</strong>
          <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 2 }}>
            <li>El usuario solicita restablecimiento desde la pagina de login.</li>
            <li>Se envia un enlace al correo institucional registrado.</li>
            <li>El enlace expira en 24 horas.</li>
            <li>Si el correo no llega, verifique que el correo institucional este registrado.</li>
            <li>Para restablecimiento manual, use el modulo de usuarios del panel administrativo.</li>
          </ol>
        </div>
      </SectionCard>
    </div>
  );
}

function BitacoraSoportePanel({ token }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.asistente.sopBitacora(token, 20).then((res) => {
      setLogs(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="stack">
      <SectionCard title="Bitacora del Sistema" subtitle="Registro de actividad y eventos del sistema">
        <div className="status-list">
          <div className="status ok">
            <ScrollText size={18} />
            Consulta de la bitacora de actividad, eventos, errores y auditoria del sistema.
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem' }}>
          <Loader2 className="animate-spin" size={18} /> Cargando bitacora...
        </div>
      ) : logs.length > 0 ? (
        <SectionCard title="Registros recientes" subtitle="Ultimos 20 eventos registrados">
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className="table-responsive"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Fecha</th>
                  <th style={{ padding: '0.4rem' }}>Modulo</th>
                  <th style={{ padding: '0.4rem' }}>Accion</th>
                  <th style={{ padding: '0.4rem' }}>Usuario</th>
                  <th style={{ padding: '0.4rem' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={l.id_bitacora || i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>
                      {new Date(l.creado_en).toLocaleString('es-MX')}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{l.modulo || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{l.accion || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{l.id_usuario || '—'}</td>
                    <td style={{ padding: '0.4rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.detalle || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Bitacora" subtitle="Registros del sistema">
          <div className="auth-note">No hay registros en la bitacora.</div>
        </SectionCard>
      )}
    </div>
  );
}

function ValidacionRutasSoporte({ token }) {
  return (
    <div className="stack">
      <SectionCard title="Validacion de Rutas" subtitle="Diagnostico de problemas de navegacion y carga de paginas">
        <div className="status-list">
          <div className="status ok">
            <Route size={18} />
            Diagnostico de rutas, problemas de navegacion, errores 404, paginas en blanco y fallos de carga.
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Rutas del sistema" subtitle="Mapeo de rutas disponibles">
        <div className="auth-note">
          <strong>Rutas principales del sistema:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 2 }}>
            <li><code>/</code> - Inicio del backend (API)</li>
            <li><code>/login</code> - Pagina de inicio de sesion</li>
            <li><code>/app/dashboard</code> - Dashboard general</li>
            <li><code>/app/alumno/*</code> - Modulo de alumno</li>
            <li><code>/app/docente/*</code> - Modulo de docente</li>
            <li><code>/app/coordinador/*</code> - Modulo de coordinador</li>
            <li><code>/app/chatbot</code> - ChatBot Institucional</li>
            <li><code>/app/soporte/*</code> - Modulo de soporte tecnico</li>
            <li><code>/api/*</code> - Endpoints de la API REST</li>
          </ul>
        </div>
      </SectionCard>

      <SectionCard title="Diagnostico rapido" subtitle="Pasos para diagnosticar problemas de navegacion">
        <div className="auth-note">
          <strong>Pasos para diagnosticar:</strong>
          <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', lineHeight: 2 }}>
            <li>Verifique la URL ingresada.</li>
            <li>Compruebe que el token de sesion sea valido (F12 &gt; Application &gt; Local Storage).</li>
            <li>Revise la consola del navegador (F12 &gt; Console) en busca de errores de JavaScript.</li>
            <li>Revise la pestana Network (F12 &gt; Network) en busca de errores HTTP (404, 500, 401).</li>
            <li>Limpie la cache del navegador y vuelva a cargar la pagina.</li>
            <li>Verifique que el backend este corriendo en <code>http://localhost:3000</code>.</li>
          </ol>
        </div>
      </SectionCard>
    </div>
  );
}

export default function ChatbotPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const role = normalizeRole(user?.rol_nombre || user?.rol || user?.role);

  const [tab, setTab] = React.useState('panel-general');

  const isAdmin = role === 'ADMINISTRADOR';
  const isCoord = role === 'COORDINADOR';
  const isDocente = role === 'DOCENTE';
  const isSoporte = role === 'SOPORTE';
  const isAlumno = role === 'ALUMNO';

  const tabs = isAlumno ? [
    { id: 'panel-personal', label: 'Panel personal', icon: User, show: true },
    { id: 'kardex-individual', label: 'Kardex individual', icon: FileText, show: true },
    { id: 'inscripciones', label: 'Inscripciones', icon: ClipboardList, show: true },
    { id: 'reinscripciones', label: 'Reinscripciones', icon: RefreshCw, show: true },
    { id: 'evaluaciones', label: 'Evaluaciones', icon: LineChart, show: true },
    { id: 'chatbot', label: 'ChatBot Institucional', icon: MessageSquareText, show: true }
  ] : isSoporte ? [
    { id: 'panel-tecnico', label: 'Panel tecnico', icon: Wrench, show: true },
    { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle, show: true },
    { id: 'recuperacion-acceso', label: 'Recup. acceso', icon: KeyRound, show: true },
    { id: 'bitacora', label: 'Bitacora', icon: ScrollText, show: true },
    { id: 'validacion-rutas', label: 'Validacion rutas', icon: Route, show: true },
    { id: 'chatbot', label: 'ChatBot Institucional', icon: MessageSquareText, show: true }
  ] : !isCoord && !isDocente ? [
    { id: 'panel-general', label: 'Panel General', icon: Activity, show: true },
    { id: 'chatbot', label: 'ChatBot Institucional', icon: MessageSquareText, show: true },
    { id: 'metricas', label: 'Metricas Globales', icon: BarChart3, show: isAdmin || isDocente },
    { id: 'incidencias', label: 'Incidencias', icon: AlertTriangle, show: isAdmin || isSoporte },
    { id: 'conversaciones', label: 'Conversaciones', icon: MessageSquareText, show: isAdmin },
    { id: 'auditoria', label: 'Auditoria', icon: Shield, show: isAdmin },
    { id: 'configuracion', label: 'Configuracion', icon: Settings, show: isAdmin }
  ].filter((t) => t.show) : isDocente ? [
    { id: 'panel-docente', label: 'Panel Docente', icon: GraduationCap, show: true },
    { id: 'grupos-asignados', label: 'Grupos Asignados', icon: BookOpen, show: true },
    { id: 'evaluaciones', label: 'Evaluaciones', icon: LineChart, show: true },
    { id: 'seguimiento-academico', label: 'Seguimiento Academico', icon: Eye, show: true },
    { id: 'chatbot', label: 'ChatBot Institucional', icon: MessageSquareText, show: true }
  ].filter((t) => t.show) : [
    { id: 'panel-academico', label: 'Panel Academico', icon: GraduationCap, show: true },
    { id: 'periodos', label: 'Periodos', icon: CalendarRange, show: true },
    { id: 'grupos', label: 'Grupos', icon: BookOpen, show: true },
    { id: 'reportes', label: 'Reportes', icon: BarChart3, show: true },
    { id: 'seguimiento', label: 'Seguimiento', icon: Eye, show: true },
    { id: 'chatbot', label: 'ChatBot Institucional', icon: MessageSquareText, show: true }
  ];

  const activeTab = tabs.find((t) => t.id === tab) ? tab : tabs[0]?.id;

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <div className="badge light">Inteligencia Institucional • ChatBot</div>
          <h1>ChatBot Institucional</h1>
          {isAlumno ? (
            <p>
              Ofrecer autoservicio academico con orientacion clara y sencilla.
              Enfoque sobre tramites, historial academico, evaluaciones y consultas frecuentes.
              Emplear lenguaje accesible, rutas guiadas y respuestas claras, directas, precisas, concisas, detalladas y explicadas.
            </p>
          ) : isSoporte ? (
            <p>
              Mantener la continuidad operativa, disminuir tiempos de respuesta, mejorar la estabilidad tecnica y fortalecer la disponibilidad del sistema.
              Diagnostico de fallas tecnicas, atencion de incidencias, revision de errores del backend, validacion de sesiones, orientacion de recuperacion de acceso y resolucion de problemas tecnicos.
            </p>
          ) : isCoord ? (
            <p>
              Facilitar la supervision academica y la intervencion oportuna en procesos institucionales.
              Alcance sobre grupos, alumnos, periodos, evaluaciones y estados de riesgo.
            </p>
          ) : isDocente ? (
            <p>
              Brindar apoyo pedagogico, operativo y consultivo al personal docente.
              Cobertura sobre materias, grupos, alumnos vinculados y actividades evaluativas.
              Proporcionar respuestas breves, concisas, detalladas, explicadas, directas, claras y orientadas a la accion.
            </p>
          ) : (
            <p>
              Apoyar la toma de decisiones, centralizar consultas y reforzar la administracion del entorno institucional.
              Cobertura total sobre modulos, usuarios, reportes, seguridad y actividad general del sistema.
            </p>
          )}
        </div>
        <div className="hero-meta">
          <div className="meta-card">
            <small>Permiso actual</small>
            <strong>{isAdmin ? 'Consulta estrategica amplia' : isCoord ? 'Consulta y gestion academica parcial' : isDocente ? 'Acceso a grupos y funciones pedagogicas' : isAlumno ? 'Acceso a orientacion y autoservicio academico' : isSoporte ? 'Diagnostico y resolucion de problemas tecnicos' : 'Soporte tecnico'}</strong>
          </div>
          <div className="meta-card">
            <small>Alcance</small>
            <strong>{isAdmin ? 'Total' : isCoord ? 'Grupos, alumnos, periodos, evaluaciones y riesgo' : isDocente ? 'Materias, grupos, alumnos y evaluaciones' : isAlumno ? 'Tramites, historial academico, evaluaciones y consultas' : isSoporte ? 'Incidencias, sesiones, errores, bitacora y rutas del sistema' : 'Consultas del sistema'}</strong>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {tabs.map((t) => (
          <TabButton key={t.id} active={activeTab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />
        ))}
      </div>

      {isAlumno ? (
        <>
          {activeTab === 'panel-personal' && <PanelPersonalAlumno token={token} user={user} onNavigateTab={setTab} />}
          {activeTab === 'kardex-individual' && <KardexIndividualAlumno token={token} />}
          {activeTab === 'inscripciones' && <InscripcionesAlumno token={token} />}
          {activeTab === 'reinscripciones' && <ReinscripcionesAlumno token={token} />}
          {activeTab === 'evaluaciones' && <EvaluacionesAlumno token={token} />}
          {activeTab === 'chatbot' && <ChatPanel token={token} role={role} />}
        </>
      ) : isSoporte ? (
        <>
          {activeTab === 'panel-tecnico' && <PanelTecnicoSoporte token={token} user={user} />}
          {activeTab === 'incidencias' && <IncidenciasSoportePanel token={token} />}
          {activeTab === 'recuperacion-acceso' && <RecuperacionAccesoSoporte token={token} />}
          {activeTab === 'bitacora' && <BitacoraSoportePanel token={token} />}
          {activeTab === 'validacion-rutas' && <ValidacionRutasSoporte token={token} />}
          {activeTab === 'chatbot' && <ChatPanel token={token} role={role} />}
        </>
      ) : isCoord ? (
        <>
          {activeTab === 'panel-academico' && <PanelAcademico token={token} />}
          {activeTab === 'periodos' && <PeriodosPanel token={token} />}
          {activeTab === 'grupos' && <GruposPanel token={token} />}
          {activeTab === 'reportes' && <ReportesPanel token={token} />}
          {activeTab === 'seguimiento' && <SeguimientoPanel token={token} />}
          {activeTab === 'chatbot' && <ChatPanel token={token} role={role} />}
        </>
      ) : isDocente ? (
        <>
          {activeTab === 'panel-docente' && <PanelDocente token={token} user={user} />}
          {activeTab === 'grupos-asignados' && <GruposAsignadosPanel token={token} />}
          {activeTab === 'evaluaciones' && <EvaluacionesDocentePanel token={token} />}
          {activeTab === 'seguimiento-academico' && <SeguimientoAcademicoDocente token={token} />}
          {activeTab === 'chatbot' && <ChatPanel token={token} role={role} />}
        </>
      ) : (
        <>
          {activeTab === 'panel-general' && <PanelGeneral token={token} user={user} />}
          {activeTab === 'chatbot' && <ChatPanel token={token} role={role} />}
          {activeTab === 'metricas' && <MetricasGlobales token={token} role={role} />}
          {activeTab === 'incidencias' && <IncidenciasPanel token={token} role={role} />}
          {activeTab === 'conversaciones' && <ConversacionesPanel token={token} />}
          {activeTab === 'auditoria' && <AuditoriaPanel token={token} />}
          {activeTab === 'configuracion' && <ConfiguracionPanel token={token} user={user} />}
        </>
      )}
    </div>
  );
}
