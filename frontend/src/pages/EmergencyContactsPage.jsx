/**
 * SIVACAD-ISC — Copyright (c) 2026 Bárcenas González Laura Casandra &
 *                    Morales Ibarra Sandivel — TESI — ISC
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowLeft, Plus, Pencil, Trash2, UserPlus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const RELACION_OPTIONS = [
  'Madre', 'Padre', 'Hermano/a', 'Tío/a', 'Abuelo/a',
  'Esposo/a', 'Pareja', 'Amigo/a', 'Tutor legal', 'Otro'
];

function ContactModal({ contact, onSave, onCancel, saving }) {
  const [form, setForm] = React.useState({
    nombre: contact?.nombre || '',
    telefono: contact?.telefono || '',
    relacion: contact?.relacion || '',
    correo: contact?.correo || '',
    direccion: contact?.direccion || '',
    es_principal: contact?.es_principal || false
  });

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-head">
          <div>
            <h3>{contact ? 'Editar contacto' : 'Agregar contacto de emergencia'}</h3>
            <p>Completa la información del contacto.</p>
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem' }}>
          <div className="field">
            <span>Nombre completo *</span>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => handleChange('nombre', e.target.value)}
              placeholder="Nombre del contacto"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="field">
              <span>Teléfono *</span>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => handleChange('telefono', e.target.value)}
                placeholder="10 dígitos"
              />
            </div>
            <div className="field">
              <span>Relación</span>
              <select value={form.relacion} onChange={(e) => handleChange('relacion', e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {RELACION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <span>Correo electrónico</span>
            <input
              type="email"
              value={form.correo}
              onChange={(e) => handleChange('correo', e.target.value)}
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div className="field">
            <span>Dirección</span>
            <input
              type="text"
              value={form.direccion}
              onChange={(e) => handleChange('direccion', e.target.value)}
              placeholder="Dirección (opcional)"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.es_principal}
              onChange={(e) => handleChange('es_principal', e.target.checked)}
            />
            <span>Contacto principal</span>
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button
            className="btn primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.nombre || !form.telefono}
          >
            {saving ? 'Guardando...' : 'Guardar contacto'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            <p>{message}</p>
          </div>
          <div className="modal-icon danger">!</div>
        </div>
        <div className="modal-note">Esta acción no se puede deshacer.</div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className="btn danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmergencyContactsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [contacts, setContacts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);
  const [editContact, setEditContact] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);

  const clearFeedback = React.useCallback(() => {
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const loadContacts = React.useCallback(async () => {
    try {
      setLoading(true);
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }
      const data = await api.request('/contactos-emergencia', { token });
      setContacts(Array.isArray(data) ? data : data?.contactos || data?.data || []);
    } catch (err) {
      if (err?.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setFeedback({ type: 'error', message: err.message || 'Error al cargar contactos' });
      clearFeedback();
    } finally {
      setLoading(false);
    }
  }, [token, clearFeedback]);

  React.useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleCreate = async (form) => {
    try {
      setSaving(true);
      await api.request('/contactos-emergencia', { token, method: 'POST', body: form });
      setFeedback({ type: 'success', message: 'Contacto registrado correctamente.' });
      clearFeedback();
      setShowModal(false);
      loadContacts();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al registrar contacto' });
      clearFeedback();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form) => {
    try {
      setSaving(true);
      await api.request(`/contactos-emergencia/${editContact.id_contacto || editContact.id}`, {
        token,
        method: 'PUT',
        body: form
      });
      setFeedback({ type: 'success', message: 'Contacto actualizado correctamente.' });
      clearFeedback();
      setEditContact(null);
      loadContacts();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al actualizar contacto' });
      clearFeedback();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.request(`/contactos-emergencia/${deleteTarget.id_contacto || deleteTarget.id}`, {
        token,
        method: 'DELETE'
      });
      setFeedback({ type: 'success', message: 'Contacto eliminado correctamente.' });
      clearFeedback();
      setDeleteTarget(null);
      loadContacts();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error al eliminar contacto' });
      clearFeedback();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page narrow">
      <section className="section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">SIVACAD | ISC</div>
            <h2>Contactos de Emergencia</h2>
            <p style={{ marginTop: '0.5rem', lineHeight: 1.7 }}>
              Administra tus contactos de emergencia para situaciones críticas.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn secondary" type="button" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} /> Volver
            </button>
            <button className="btn primary" type="button" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Agregar
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`auth-note ${feedback.type === 'error' ? 'error' : ''}`}
            style={{ marginBottom: '1rem' }}
          >
            <div className="eyebrow">
              {feedback.type === 'error' ? 'Error' : <><CheckCircle2 size={14} /> Éxito</>}
            </div>
            <p style={{ margin: '0.4rem 0 0', lineHeight: 1.65 }}>{feedback.message}</p>
          </div>
        )}

        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center' }}>Cargando contactos...</p>
        ) : contacts.length === 0 ? (
          <div className="auth-note" style={{ textAlign: 'center', padding: '2rem' }}>
            <UserPlus size={32} style={{ opacity: 0.5 }} />
            <p style={{ margin: '0.75rem 0 0' }}>
              No tienes contactos de emergencia registrados.
            </p>
            <button
              className="btn primary"
              type="button"
              onClick={() => setShowModal(true)}
              style={{ marginTop: '1rem' }}
            >
              <Plus size={16} /> Agregar primer contacto
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {contacts.map((contact) => (
              <div
                key={contact.id_contacto || contact.id}
                style={{
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '12px',
                  border: contact.es_principal ? '2px solid var(--primary)' : '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Phone size={16} />
                      <strong>{contact.nombre}</strong>
                      {contact.es_principal && (
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.5rem',
                          background: 'var(--primary)',
                          color: '#fff',
                          borderRadius: '9999px'
                        }}>
                          Principal
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      <div>Tel: {contact.telefono}</div>
                      {contact.relacion && <div>Relación: {contact.relacion}</div>}
                      {contact.correo && <div>Correo: {contact.correo}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => setEditContact(contact)}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => setDeleteTarget(contact)}
                      title="Eliminar"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal && (
        <ContactModal
          onSave={handleCreate}
          onCancel={() => setShowModal(false)}
          saving={saving}
        />
      )}

      {editContact && (
        <ContactModal
          contact={editContact}
          onSave={handleUpdate}
          onCancel={() => setEditContact(null)}
          saving={saving}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar contacto"
          message={`¿Estás seguro de eliminar a "${deleteTarget.nombre}" de tus contactos de emergencia?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
