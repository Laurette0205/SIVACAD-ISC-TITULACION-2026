'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authCtrl = require('../controllers/auth');
const { auth: verifyToken } = require('../middleware/auth');

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Has superado el límite de solicitudes. Intenta de nuevo en 15 minutos.'
  }
});

const ALLOWED_EMAIL_DOMAINS = String(
  process.env.ALLOWED_INSTITUTION_EMAIL_DOMAINS ||
    'tesi.edu.mx,ixtapaluca.tecnm.mx,ixtapaluca.tecnm.edu.mx,outlook.com,outlook.es'
)
  .split(',')
  .map((domain) => String(domain || '').trim().toLowerCase().replace(/^@+/, ''))
  .filter(Boolean);

function isAllowedInstitutionalEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  const atIndex = value.lastIndexOf('@');

  if (atIndex === -1) return false;

  const domain = value.slice(atIndex + 1).trim();
  return ALLOWED_EMAIL_DOMAINS.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`)
  );
}

function validateInstitutionalEmail(req, res, next) {
  const correo = req.body?.correo;

  if (!correo || !String(correo).trim()) {
    return res.status(400).json({
      ok: false,
      message: 'El correo es obligatorio.'
    });
  }

  if (!isAllowedInstitutionalEmail(correo)) {
    return res.status(403).json({
      ok: false,
      message:
        'Solo se permiten correos institucionales autorizados: @tesi.edu.mx, @ixtapaluca.tecnm.mx, @ixtapaluca.tecnm.edu.mx, @outlook.com y @outlook.es.'
    });
  }

  return next();
}

router.post('/register', validateInstitutionalEmail, authCtrl.register);
router.post('/login', validateInstitutionalEmail, authCtrl.login);
router.get('/me', verifyToken, authCtrl.me);
router.post('/forgot-password', forgotPasswordLimiter, validateInstitutionalEmail, authCtrl.forgotPassword);

/*
  Reset por token:
  no se valida correo aquí porque el frontend envía únicamente el token.
*/
router.post('/reset-password/:token', authCtrl.resetPassword);

module.exports = router;