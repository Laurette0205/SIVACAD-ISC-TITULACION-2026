import React from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const SEVERITY_COLORS = {
  BAJA: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
  MEDIA: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  ALTA: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
  CRITICA: { bg: '#fce7f3', text: '#9d174d', border: '#fbcfe8' }
};

const ESTADO_COLORS = {
  PENDIENTE: { bg: '#fef3c7', text: '#92400e' },
  REVISADA: { bg: '#dbeafe', text: '#1e40af' },
  RESUELTA: { bg: '#d1fae5', text: '#065f46' },
  DESCARTADA: { bg: '#f3f4f6', text: '#6b7280' }
};

function StatCard({ label, value, accent = 'info' }) {
  const accents = {
    info: { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    success: { border: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
    warning: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
    error: { border: '#ef4444', bg: 'rgba(239,68,68,0.08)' }
  };
  const a = accents[accent] || accents.info;

  return (
    <div
      style={{
        background: a.bg,
        border: `1px solid ${a.border}20`,
        borderLeft: `3px solid ${a.border}`,
        borderRadius: '10px',
        padding: '1rem 1.25rem',
        minWidth: 160
      }}
    >
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: a.border }}>
        {value}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.MEDIA;
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.6rem',
      borderRadius: '999px',
      fontSize: '0.72rem',
      fontWeight: 600,
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`
    }}>
      {severity}
    </span>
  );
}

function EstadoBadge({ estado }) {
  const colors = ESTADO_COLORS[estado] || ESTADO_COLORS.PENDIENTE;
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.6rem',
      borderRadius: '999px',
      fontSize: '0.72rem',
      fontWeight: 600,
      background: colors.bg,
      color: colors.text
    }}>
      {estado}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataTable({ columns, data, emptyText = 'Sin datos' }) {
  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emptyText}</p>;
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)' }}>
            {columns.map((col, i) => (
              <th key={i} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--border-color)' }}>
              {columns.map((col, ci) => (
                <td key={ci} style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary)' }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SecurityDashboardPage() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = React.useState(null);
  const [alerts, setAlerts] = React.useState([]);
  const [devices, setDevices] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [filterSeverity, setFilterSeverity] = React.useState('');
  const [filterEstado, setFilterEstado] = React.useState('');

  const loadDashboard = React.useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, alertsRes, devicesRes] = await Promise.allSettled([
        api.securityDashboard(token),
        api.securityAlerts(token, { severidad: filterSeverity || undefined, estado: filterEstado || undefined }),
        api.securityDevicesAll(token)
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value?.ok) {
        setDashboard(dashRes.value.data);
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value?.ok) {
        setAlerts(alertsRes.value.data?.rows || []);
      }
      if (devicesRes.status === 'fulfilled' && devicesRes.value?.ok) {
        setDevices(devicesRes.value.data || []);
      }
    } catch (err) {
      console.error('Error loading security dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filterSeverity, filterEstado]);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleAlertAction = async (id, estado) => {
    try {
      await api.securityAlertUpdate(token, id, { estado });
      loadDashboard();
    } catch (err) {
      console.error('Error updating alert:', err);
    }
  };

  const handleTrustDevice = async (id) => {
    try {
      await api.securityDeviceTrust(token, id);
      loadDashboard();
    } catch (err) {
      console.error('Error trusting device:', err);
    }
  };

  const handleRevokeDevice = async (id) => {
    try {
      await api.securityDeviceRevoke(token, id);
      loadDashboard();
    } catch (err) {
      console.error('Error revoking device:', err);
    }
  };

  if (loading && !dashboard) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando panel de seguridad...
      </div>
    );
  }

  const alertasCount = dashboard?.alertas24h || [];
  const bySeverity = {};
  alertasCount.forEach(a => { bySeverity[a.severidad] = a.total; });

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Panel de Seguridad</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Monitoreo de suplantación, escalamiento y anomalías</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard label="Alertas 24h" value={bySeverity.CRITICA || 0} accent="error" />
        <StatCard label="Alta severidad" value={bySeverity.ALTA || 0} accent="warning" />
        <StatCard label="Media severidad" value={bySeverity.MEDIA || 0} accent="info" />
        <StatCard label="Pendientes" value={dashboard?.pendientes || 0} accent="warning" />
        <StatCard label="Dispositivos" value={devices.length} accent="success" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {[
          { key: 'overview', label: 'Resumen' },
          { key: 'alerts', label: 'Alertas' },
          { key: 'devices', label: 'Dispositivos' },
          { key: 'changes', label: 'Cambios críticos' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 500,
              background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              transition: 'all 150ms ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <Section title="Top usuarios con más alertas (7 días)">
            <DataTable
              columns={[
                { header: 'Usuario', render: (r) => `${r.nombres || ''} ${r.apellido_paterno || ''}`.trim() || `ID: ${r.id_usuario_afectado}` },
                { header: 'Alertas', key: 'total_alertas' },
                { header: 'Severidad max', render: (r) => <SeverityBadge severity={r.max_severidad} /> }
              ]}
              data={dashboard?.topUsuarios}
            />
          </Section>

          <Section title="IPs con más intentos sospechosos (24h)">
            <DataTable
              columns={[
                { header: 'IP', key: 'ip_origen' },
                { header: 'Intentos', key: 'total' },
                { header: 'Último', render: (r) => r.ultimo_intento ? new Date(r.ultimo_intento).toLocaleString('es-MX') : '-' }
              ]}
              data={dashboard?.topIps}
            />
          </Section>

          <Section title="Dispositivos por usuario">
            <DataTable
              columns={[
                { header: 'Usuario ID', key: 'id_usuario' },
                { header: 'Total', key: 'total_dispositivos' },
                { header: 'Confiables', key: 'confiables' }
              ]}
              data={dashboard?.dispositivosPorUsuario}
            />
          </Section>

          <Section title="Dispositivos con IPs inusuales (24h)">
            <DataTable
              columns={[
                { header: 'Usuario ID', key: 'id_usuario' },
                { header: 'IPs distintas', key: 'ips_distintas' }
              ]}
              data={dashboard?.dispositivosSospechosos}
              emptyText="Ninguno detectado"
            />
          </Section>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">Todas las severidades</option>
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.82rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="REVISADA">Revisada</option>
              <option value="RESUELTA">Resuelta</option>
              <option value="DESCARTADA">Descartada</option>
            </select>
            <button
              onClick={loadDashboard}
              style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.82rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              Actualizar
            </button>
          </div>

          <DataTable
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Tipo', key: 'tipo_alerta' },
              { header: 'Usuario', render: (r) => `${r.nombres || ''} ${r.apellido_paterno || ''}`.trim() || `ID: ${r.id_usuario_afectado}` },
              { header: 'Título', key: 'titulo' },
              { header: 'Severidad', render: (r) => <SeverityBadge severity={r.severidad} /> },
              { header: 'Estado', render: (r) => <EstadoBadge estado={r.estado} /> },
              { header: 'IP', key: 'ip_origen' },
              { header: 'Fecha', render: (r) => r.created_at ? new Date(r.created_at).toLocaleString('es-MX') : '-' },
              {
                header: 'Acciones',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {r.estado === 'PENDIENTE' && (
                      <>
                        <button onClick={() => handleAlertAction(r.id, 'REVISADA')} style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #3b82f6', background: '#dbeafe', color: '#1e40af', cursor: 'pointer', fontSize: '0.72rem' }}>Revisar</button>
                        <button onClick={() => handleAlertAction(r.id, 'RESUELTA')} style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #22c55e', background: '#d1fae5', color: '#065f46', cursor: 'pointer', fontSize: '0.72rem' }}>Resolver</button>
                        <button onClick={() => handleAlertAction(r.id, 'DESCARTADA')} style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #9ca3af', background: '#f3f4f6', color: '#6b7280', cursor: 'pointer', fontSize: '0.72rem' }}>Descartar</button>
                      </>
                    )}
                  </div>
                )
              }
            ]}
            data={alerts}
            emptyText="No hay alertas registradas"
          />
        </div>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <div>
          <Section title="Todos los dispositivos conocidos">
            <DataTable
              columns={[
                { header: 'ID', key: 'id' },
                { header: 'Usuario', render: (r) => `${r.nombres || ''} ${r.apellido_paterno || ''}`.trim() || `ID: ${r.id_usuario}` },
                { header: 'Hash', render: (r) => r.dispositivo_hash?.slice(0, 12) + '...' },
                { header: 'IP inicial', key: 'ip_primera_sesion' },
                { header: 'IP última', key: 'ip_ultima_sesion' },
                { header: 'Confiable', render: (r) => r.es_confiable ? '✅' : '⚠️' },
                { header: 'Último visto', render: (r) => r.ultimo_visto ? new Date(r.ultimo_visto).toLocaleString('es-MX') : '-' },
                {
                  header: 'Acciones',
                  render: (r) => (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {!r.es_confiable && (
                        <button onClick={() => handleTrustDevice(r.id)} style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #22c55e', background: '#d1fae5', color: '#065f46', cursor: 'pointer', fontSize: '0.72rem' }}>Confiar</button>
                      )}
                      <button onClick={() => handleRevokeDevice(r.id)} style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid #ef4444', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontSize: '0.72rem' }}>Revocar</button>
                    </div>
                  )
                }
              ]}
              data={devices}
              emptyText="No hay dispositivos registrados"
            />
          </Section>
        </div>
      )}

      {/* Changes Tab */}
      {activeTab === 'changes' && (
        <div>
          <Section title="Cambios críticos recientes">
            <DataTable
              columns={[
                { header: 'Tipo', key: 'tipo_cambio' },
                { header: 'Usuario', render: (r) => `${r.nombres || ''} ${r.apellido_paterno || ''}`.trim() || `ID: ${r.id_usuario}` },
                { header: 'Campo', key: 'campo' },
                { header: 'Anterior', render: (r) => <span style={{ color: '#ef4444' }}>{r.valor_anterior}</span> },
                { header: 'Nuevo', render: (r) => <span style={{ color: '#22c55e' }}>{r.valor_nuevo}</span> },
                { header: 'IP', key: 'ip_origen' },
                { header: 'Reauth', render: (r) => r.requiere_reauth ? (r.reauth_verificado ? '✅' : '❌') : '-' },
                { header: 'Fecha', render: (r) => r.created_at ? new Date(r.created_at).toLocaleString('es-MX') : '-' }
              ]}
              data={dashboard?.cambiosRecientes}
              emptyText="No hay cambios críticos registrados"
            />
          </Section>
        </div>
      )}
    </div>
  );
}
