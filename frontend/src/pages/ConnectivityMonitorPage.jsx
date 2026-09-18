/**
 * SIVACAD-ISC — Monitoreo de Conectividad y Continuidad Operativa
 * Dashboard para administradores: estado del sistema, cola offline, sesiones emergencia
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, Database, Wifi, WifiOff, Clock, RefreshCw,
  Loader2, CheckCircle2, AlertTriangle, Server, HardDrive, Zap,
  Shield, Users, CloudOff, ArrowUpDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ConnectivityMonitorPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [error, setError] = useState(null);

  const loadHealth = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const base = `${window.location.protocol}//${window.location.hostname}:3000`;
      const resp = await fetch(`${base}/api/health`);
      const data = await resp.json();
      setHealth(data);
      setLastCheck(new Date());
    } catch (err) {
      setError('No se pudo conectar al servidor backend');
      setHealth(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  useEffect(() => {
    const interval = setInterval(() => loadHealth(true), 30000);
    return () => clearInterval(interval);
  }, [loadHealth]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'ok': case 'up': return '#22c55e';
      case 'configured': return '#3b82f6';
      case 'degraded': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok': case 'up': return <CheckCircle2 size={16} />;
      case 'configured': return <Zap size={16} />;
      case 'degraded': return <AlertTriangle size={16} />;
      case 'error': return <AlertTriangle size={16} />;
      default: return <Activity size={16} />;
    }
  };

  if (loading) {
    return <div className="page-loading"><Loader2 size={32} className="spin" /> Cargando estado del sistema...</div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}><Activity size={20} /> Monitoreo de Conectividad</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Estado del sistema, continuidad operativa y salud de servicios
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => loadHealth(true)} disabled={refreshing}>
          {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Actualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Estado General */}
      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Server size={20} />
          <h3 style={{ margin: 0 }}>Estado del Sistema</h3>
          {health && (
            <span style={{
              marginLeft: 'auto',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: `${getStatusColor(health.status)}20`,
              color: getStatusColor(health.status),
              display: 'flex', alignItems: 'center', gap: '0.3rem'
            }}>
              {getStatusIcon(health.status)} {health.status?.toUpperCase()}
            </span>
          )}
        </div>

        {health ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <StatusCard
              icon={<Database size={18} />}
              label="Base de Datos"
              value={health.checks?.database?.status === 'ok' ? 'Conectada' : 'Error'}
              detail={health.checks?.database?.latency ? `${health.checks.database.latency}ms` : health.checks?.database?.message}
              status={health.checks?.database?.status}
            />
            <StatusCard
              icon={<HardDrive size={18} />}
              label="Memoria"
              value={health.checks?.memory?.heap || 'N/A'}
              detail={`RSS: ${health.checks?.memory?.rss || 'N/A'}`}
              status="ok"
            />
            <StatusCard
              icon={<Clock size={18} />}
              label="Uptime"
              value={health.uptime || 'N/A'}
              detail={`Checks: ${Object.keys(health.checks || {}).length}`}
              status="ok"
            />
            <StatusCard
              icon={<ArrowUpDown size={18} />}
              label="Cola Offline"
              value={`${health.checks?.offlineSync?.pendingEvents || 0} pendientes`}
              detail="Eventos sin sincronizar"
              status={(health.checks?.offlineSync?.pendingEvents || 0) > 10 ? 'degraded' : 'ok'}
            />
            <StatusCard
              icon={<Shield size={18} />}
              label="Sesiones Emergencia"
              value={`${health.checks?.emergencySessions?.active || 0} activas`}
              detail="Sesiones break-glass"
              status="ok"
            />
            <StatusCard
              icon={<Zap size={18} />}
              label="Gemini AI"
              value={health.checks?.gemini?.status === 'configured' ? 'Configurado' : 'No disponible'}
              detail="API de IA"
              status={health.checks?.gemini?.status || 'error'}
            />
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No se pudo obtener el estado del sistema
          </p>
        )}

        {lastCheck && (
          <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
            Última verificación: {lastCheck.toLocaleTimeString('es-MX')}
          </div>
        )}
      </div>

      {/* Capas de Conectividad */}
      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Capas de Conectividad</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <ConnectivityLayer
            layer={1}
            title="Internet Principal"
            description="Conexión WAN primaria del campus"
            status="active"
            capabilities={['Acceso completo a SIVACAD', 'APIs externas (Gemini)', 'Correo electrónico', 'Actualizaciones']}
          />
          <ConnectivityLayer
            layer={2}
            title="Internet Secundario (Backup)"
            description="Enlace WAN de respaldo (failover automático)"
            status="standby"
            capabilities={['Mismo acceso que Capa 1', 'Activación automática si falla Capa 1', 'Balanceo de carga']}
          />
          <ConnectivityLayer
            layer={3}
            title="Red LAN Institucional"
            description="Servidor local accesible por red interna"
            status="available"
            capabilities={['Backend + MySQL en servidor local', 'Frontend servido por Vite/Express', 'Acceso sin internet', 'Sync offline→online']}
          />
          <ConnectivityLayer
            layer={4}
            title="Modo Offline (Cliente)"
            description="IndexedDB + Service Worker en el navegador"
            status="always"
            capabilities={['Navegación de páginas cacheadas', 'Formularios guardados localmente', 'Cola de sincronización', 'Lectura de datos cacheados']}
          />
        </div>
      </div>

      {/* Tabla de Operaciones por Capa */}
      <div className="section-card">
        <h3 style={{ marginBottom: '1rem' }}>Operaciones por Nivel de Conectividad</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Operación</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Internet</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>LAN</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Offline</th>
              </tr>
            </thead>
            <tbody>
              <OperationRow op="Login / Autenticación" internet="✓" lan="✓" offline="✗" />
              <OperationRow op="Ver dashboard" internet="✓" lan="✓" offline="Cache" />
              <OperationRow op="Inscribirse a materia" internet="✓" lan="✓" offline="Cola" />
              <OperationRow op="Subir documentos" internet="✓" lan="✓" offline="Cola" />
              <OperationRow op="Ver kardex / calificaciones" internet="✓" lan="✓" offline="Cache" />
              <OperationRow op="Enviar solicitud de trámite" internet="✓" lan="✓" offline="Cola" />
              <OperationRow op="Chatbot IA (Gemini)" internet="✓" lan="✗" offline="✗" />
              <OperationRow op="Deserción IA (predicción)" internet="✓" lan="✗" offline="✗" />
              <OperationRow op="Generar PDF/Excel" internet="✓" lan="✓" offline="✗" />
              <OperationRow op="Consulta de emergencia" internet="✓" lan="✓" offline="✗" />
              <OperationRow op="Compartir ubicación" internet="✓" lan="✓" offline="✗" />
              <OperationRow op="Sync offline→online" internet="✓" lan="✓" offline="—" />
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <strong>Cache</strong> = datos leídos de IndexedDB (TTL limitado) &nbsp;|&nbsp;
          <strong>Cola</strong> = se guarda localmente, se envía al reconectar &nbsp;|&nbsp;
          <strong>—</strong> = no aplica
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, label, value, detail, status }) {
  return (
    <div style={{
      padding: '1rem',
      background: 'var(--bg-secondary)',
      borderRadius: '12px',
      borderLeft: `3px solid ${status === 'ok' || status === 'configured' ? '#22c55e' : status === 'degraded' ? '#f59e0b' : '#ef4444'}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
        {icon} <span style={{ fontSize: '0.8rem' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{value}</div>
      {detail && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{detail}</div>}
    </div>
  );
}

function ConnectivityLayer({ layer, title, description, status, capabilities }) {
  const colors = { active: '#22c55e', standby: '#f59e0b', available: '#3b82f6', always: '#8b5cf6' };
  const labels = { active: 'ACTIVA', standby: 'STANDBY', available: 'DISPONIBLE', always: 'SIEMPRE' };

  return (
    <div style={{
      padding: '1rem',
      background: 'var(--bg-secondary)',
      borderRadius: '12px',
      borderLeft: `3px solid ${colors[status]}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%',
          background: `${colors[status]}20`, color: colors[status],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.85rem'
        }}>{layer}</span>
        <div>
          <strong>{title}</strong>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: `${colors[status]}20`, color: colors[status], borderRadius: '9999px' }}>
            {labels[status]}
          </span>
        </div>
      </div>
      <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {capabilities.map((cap, i) => (
          <span key={i} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'var(--bg-primary)', borderRadius: '9999px', border: '1px solid var(--border)' }}>
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
}

function OperationRow({ op, internet, lan, offline }) {
  const renderCell = (val) => {
    if (val === '✓') return <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>;
    if (val === '✗') return <span style={{ color: '#ef4444' }}>✗</span>;
    if (val === 'Cache' || val === 'Cola') return <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>{val}</span>;
    return <span style={{ color: 'var(--text-secondary)' }}>{val}</span>;
  };

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '0.6rem 0.75rem' }}>{op}</td>
      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>{renderCell(internet)}</td>
      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>{renderCell(lan)}</td>
      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>{renderCell(offline)}</td>
    </tr>
  );
}
