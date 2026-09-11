const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { auth, role } = require('../middleware/auth');
const {
  getMiInformacion,
  solicitarInscripcion,
  getMiEstatus,
  getDocumentosRequeridos,
  subirDocumento,
  getMiHistorial,
  descargarComprobante
} = require('../controllers/inscripciones-alumno');

const ROLES_ALUMNO = ['ALUMNO'];
const ROLES_ALUMNO_ADMIN = ['ALUMNO', 'ADMINISTRADOR', 'COORDINADOR'];

const DOCS_DIR = path.resolve(process.cwd(), 'uploads', 'documentos');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const name = `doc-${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, name);
  }
});

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido. Use PDF, JPG, PNG o DOC'), false);
    }
    cb(null, true);
  }
});

router.get('/mi-informacion', auth, role(...ROLES_ALUMNO_ADMIN), getMiInformacion);

router.post('/solicitar', auth, role(...ROLES_ALUMNO), solicitarInscripcion);

router.get('/mi-estatus', auth, role(...ROLES_ALUMNO_ADMIN), getMiEstatus);

router.get('/documentos', auth, role(...ROLES_ALUMNO_ADMIN), getDocumentosRequeridos);

router.post('/documentos/subir', auth, role(...ROLES_ALUMNO), uploadDoc.single('archivo'), subirDocumento);

router.get('/historial', auth, role(...ROLES_ALUMNO_ADMIN), getMiHistorial);

router.get('/comprobante/:id', auth, role(...ROLES_ALUMNO), descargarComprobante);

module.exports = router;
