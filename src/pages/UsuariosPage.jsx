import React from 'react';
import SectionCard from '../components/SectionCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ESTATUS_ACADEMICO_OPTIONS = [
  'Regular', 'Irregular', 'Egresado', 'Baja_Temporal', 'Baja_Definitiva'
];

const ESTADO_USUARIO_OPTIONS = ['Activo', 'Inactivo', 'Bloqueado'];

const ESTATUS_DOCENTE_OPTIONS = ['Activo', 'Inactivo'];

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
        <div className="modal-note">Esta acci&oacute;n no se puede deshacer.</div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ title, fields, values, onChange, onSave, onCancel, saving }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-head">
          <div>
            <h3>Modificar {title}</h3>
            <p>Actualiza los campos que deseas cambiar.</p>
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem' }}>
          {fields.map((field) => (
            <div className="field" key={field.key}>
              <span>{field.label}</span>
              {field.options ? (
                <select value={values[field.key] || ''} onChange={(e) => onChange(field.key, e.target.value)}>
                  <option value="">-- Seleccionar --</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={values[field.key] || ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder || field.label}
                />
              )}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button className="btn primary" onClick={onSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const { token, user } = useAuth();

  const [alumnos, setAlumnos] = React.useState([]);
  const [docentes, setDocentes] = React.useState([]);
  const [feedback, setFeedback] = React.useState(null);

  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);

  const [editTarget, setEditTarget] = React.useState(null);
  const [editValues, setEditValues] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  const clearFeedback = () => {
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = React.useCallback(async () => {
    try {
      const resAlumnos = await api.alumnos(token);
      setAlumnos(resAlumnos.data || []);
    } catch {
      setAlumnos([]);
    }

    try {
      const resDocentes = await api.docentes(token);
      setDocentes(resDocentes.data || []);
    } catch {
      setDocentes([]);
    }
  }, [token]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'alumno') {
        await api.deleteAlumno(token, deleteTarget.id);
      } else {
        await api.deleteDocente(token, deleteTarget.id);
      }
      setFeedback({ type: 'success', message: `${deleteTarget.label} eliminado correctamente.` });
      setDeleteTarget(null);
      loadData();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Error al eliminar.' });
    } finally {
      setDeleting(false);
      clearFeedback();
    }
  };

  const openEditAlumno = (alumno) => {
    setEditTarget({ type: 'alumno', id: alumno.id_alumno, label: `${alumno.nombre} ${alumno.apellidos}` });
    setEditValues({
      nombres: alumno.nombres || '',
      apellido_paterno: alumno.apellido_paterno || '',
      apellido_materno: alumno.apellido_materno || '',
      matricula: alumno.matricula || '',
      semestre_actual: alumno.semestre_actual || '',
      estatus_academico: alumno.estatus_academico || '',
      correo_institucional: alumno.correo_institucional || '',
      estado: alumno.estado || ''
    });
  };

  const openEditDocente = (docente) => {
    setEditTarget({ type: 'docente', id: docente.id_docente, label: `${docente.nombre} ${docente.apellidos}` });
    setEditValues({
      clave_docente: docente.clave_docente || '',
      numero_empleado: docente.numero_empleado || '',
      especialidad: docente.especialidad || '',
      estatus: docente.estatus || '',
      correo_institucional: docente.correo_institucional || '',
      estado: docente.estado || ''
    });
  };

  const handleEditChange = (key, value) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      if (editTarget.type === 'alumno') {
        await api.updateAlumno(token, editTarget.id, editValues);
      } else {
        await api.updateDocente(token, editTarget.id, editValues);
      }
      setFeedback({ type: 'success', message: `${editTarget.label} actualizado correctamente.` });
      setEditTarget(null);
      loadData();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Error al actualizar.' });
    } finally {
      setSaving(false);
      clearFeedback();
    }
  };

  const alumnoEditFields = [
    { key: 'nombres', label: 'Nombre(s)' },
    { key: 'apellido_paterno', label: 'Apellido paterno' },
    { key: 'apellido_materno', label: 'Apellido materno' },
    { key: 'matricula', label: 'Matr&iacute;cula' },
    { key: 'semestre_actual', label: 'Semestre actual', type: 'number' },
    { key: 'estatus_academico', label: 'Estatus acad&eacute;mico', options: ESTATUS_ACADEMICO_OPTIONS },
    { key: 'correo_institucional', label: 'Correo institucional', type: 'email' },
    { key: 'estado', label: 'Estado del usuario', options: ESTADO_USUARIO_OPTIONS }
  ];

  const docenteEditFields = [
    { key: 'clave_docente', label: 'Clave docente' },
    { key: 'numero_empleado', label: 'N&uacute;mero de empleado' },
    { key: 'especialidad', label: 'Especialidad' },
    { key: 'estatus', label: 'Estatus', options: ESTATUS_DOCENTE_OPTIONS },
    { key: 'correo_institucional', label: 'Correo institucional', type: 'email' },
    { key: 'estado', label: 'Estado del usuario', options: ESTADO_USUARIO_OPTIONS }
  ];

  return (
    <div className="two-col">

      {feedback && (
        <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
          <div className={`alert ${feedback.type}`}>{feedback.message}</div>
        </div>
      )}

      <SectionCard title="Alumnos" subtitle="Listado institucional ISC">
        <div className="list">
          {alumnos.length === 0 ? (
            <div className="empty">No hay alumnos registrados.</div>
          ) : (
            alumnos.map((alumno) => (
              <div className="list-item" key={alumno.id_alumno}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <div>
                    <strong>{alumno.nombre} {alumno.apellidos}</strong>
                    <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--muted)' }}>
                      {alumno.matricula} &bull; {alumno.estatus_academico}
                    </span>
                  </div>
                  <div className="list-actions">
                    <button
                      className="btn btn-sm btn-edit"
                      title="Modificar alumno"
                      onClick={() => openEditAlumno(alumno)}
                    >
                      Modificar
                    </button>
                    <button
                      className="btn btn-sm btn-delete"
                      title="Eliminar alumno"
                      onClick={() => setDeleteTarget({ type: 'alumno', id: alumno.id_alumno, label: `${alumno.nombre} ${alumno.apellidos}` })}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Docentes" subtitle="Listado institucional ISC">
        <div className="list">
          {docentes.length === 0 ? (
            <div className="empty">No hay docentes registrados.</div>
          ) : (
            docentes.map((docente) => (
              <div className="list-item" key={docente.id_docente}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <div>
                    <strong>{docente.nombre} {docente.apellidos}</strong>
                    <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--muted)' }}>
                      {docente.clave_docente} &bull; {docente.especialidad}
                    </span>
                  </div>
                  <div className="list-actions">
                    <button
                      className="btn btn-sm btn-edit"
                      title="Modificar docente"
                      onClick={() => openEditDocente(docente)}
                    >
                      Modificar
                    </button>
                    <button
                      className="btn btn-sm btn-delete"
                      title="Eliminar docente"
                      onClick={() => setDeleteTarget({ type: 'docente', id: docente.id_docente, label: `${docente.nombre} ${docente.apellidos}` })}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="muted small" style={{ marginTop: '1rem' }}>
          Rol actual: {user?.rol}
        </div>
      </SectionCard>

      {deleteTarget && (
        <ConfirmModal
          title={`Eliminar ${deleteTarget.type === 'alumno' ? 'alumno' : 'docente'}`}
          message={`Se eliminar&aacute; permanentemente a ${deleteTarget.label} y todos sus datos asociados.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {editTarget && (
        <EditModal
          title={editTarget.type === 'alumno' ? 'alumno' : 'docente'}
          fields={editTarget.type === 'alumno' ? alumnoEditFields : docenteEditFields}
          values={editValues}
          onChange={handleEditChange}
          onSave={handleEditSave}
          onCancel={() => setEditTarget(null)}
          saving={saving}
        />
      )}

    </div>
  );
}