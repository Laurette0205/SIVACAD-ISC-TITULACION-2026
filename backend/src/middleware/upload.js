// backend/src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
const ALUMNOS_DIR = path.join(UPLOADS_ROOT, 'alumnos');
const QR_DIR = path.join(UPLOADS_ROOT, 'qrs');

for (const dir of [UPLOADS_ROOT, ALUMNOS_DIR, QR_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function imageFileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(
      new Error('Solo se permiten imágenes JPG, PNG o WEBP'),
      false
    );
  }
  cb(null, true);
}

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ALUMNOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `alumno-${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, name);
  }
});

exports.uploadAlumnoFoto = multer({
  storage: photoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: imageFileFilter
});

// ========================================
// ALMACENAMIENTO PARA DOCUMENTOS GENERALES
// (Trámites, actas, etc.)
// ========================================
const DOCS_DIR = path.join(UPLOADS_ROOT, 'documentos');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const name = `doc-${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, name);
  }
});

exports.docUpload = multer({
  storage: docStorage,
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

exports.UPLOADS_ROOT = UPLOADS_ROOT;
exports.ALUMNOS_DIR = ALUMNOS_DIR;
exports.QR_DIR = QR_DIR;