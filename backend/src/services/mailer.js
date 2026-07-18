'use strict';

const nodemailer = require('nodemailer');

function getSmtpValue(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function isDevelopmentMode() {
  return String(process.env.NODE_ENV || 'development').trim().toLowerCase() !== 'production';
}

function isSmtpConfigured() {
  return hasValidSmtpConfig();
}

function isPlaceholderSmtpValue(value) {
  const v = String(value || '').trim().toLowerCase();
  return (
    !v ||
    v === 'smtp.example.com' ||
    v === 'your_smtp_username' ||
    v === 'your_smtp_password'
  );
}

function hasValidSmtpConfig() {
  const host = getSmtpValue('SMTP_HOST');
  const user = getSmtpValue('SMTP_USER', 'SMTP_USERNAME', 'SMTP_MAIL');
  const pass = getSmtpValue('SMTP_PASS', 'SMTP_PASSWORD', 'SMTP_SECRET');

  if (!host || !user || !pass) return false;
  if (isPlaceholderSmtpValue(host)) return false;
  if (isPlaceholderSmtpValue(user)) return false;
  if (isPlaceholderSmtpValue(pass)) return false;

  return true;
}

function getTransporter() {
  const host = getSmtpValue('SMTP_HOST');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = getSmtpValue('SMTP_USER', 'SMTP_USERNAME', 'SMTP_MAIL');
  const pass = getSmtpValue('SMTP_PASS', 'SMTP_PASSWORD', 'SMTP_SECRET');

  if (!hasValidSmtpConfig()) {
    if (isDevelopmentMode()) return null;

    throw new Error(
      'SMTP no configurado correctamente. Verifica SMTP_HOST, SMTP_PORT, SMTP_USER/SMTP_USERNAME, SMTP_PASS/SMTP_PASSWORD y SMTP_FROM_EMAIL.'
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

function getMailFrom() {
  const fromEmail = getSmtpValue(
    'SMTP_FROM_EMAIL',
    'SMTP_FROM',
    'SMTP_USER',
    'SMTP_USERNAME'
  );
  const fromName = getSmtpValue('SMTP_FROM_NAME') || 'SIVACAD TESI';

  if (!fromEmail) {
    if (isDevelopmentMode()) {
      return {
        from: `"${fromName}" <no-reply@localhost>`,
        fromEmail: 'no-reply@localhost',
        fromName
      };
    }

    throw new Error('No se pudo determinar el remitente SMTP. Define SMTP_FROM_EMAIL o SMTP_FROM.');
  }

  return {
    from: `"${fromName}" <${fromEmail}>`,
    fromEmail,
    fromName
  };
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!to || !resetUrl) {
    throw new Error('Faltan datos para enviar el correo de recuperación.');
  }

  const safeName = String(name || 'usuario').trim();
  const subject = 'SIVACAD | Recuperación de contraseña institucional';

  const text = `
Hola ${safeName}.

Recibimos una solicitud para restablecer tu contraseña institucional en SIVACAD.

Ingresa al siguiente enlace para continuar:
${resetUrl}

Este enlace caduca en 15 minutos.

Si no solicitaste este cambio, ignora este mensaje.
  `.trim();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #0f172a;">
      <h2 style="margin:0 0 12px 0;">Recuperación de contraseña institucional</h2>
      <p>Hola <strong>${safeName}</strong>.</p>
      <p>Recibimos una solicitud para restablecer tu contraseña institucional en <strong>SIVACAD</strong>.</p>
      <p>
        Haz clic en el siguiente enlace para continuar:
        <br />
        <a href="${resetUrl}" target="_blank" rel="noreferrer">${resetUrl}</a>
      </p>
      <p>Este enlace caduca en <strong>15 minutos</strong>.</p>
      <p>Si no solicitaste este cambio, ignora este mensaje.</p>
    </div>
  `;

  const transporter = getTransporter();
  const { from } = getMailFrom();

  if (!transporter) {
    console.warn('\n[MAILER][DEV] SMTP no configurado. Se omite el envío real del correo.');
    console.warn(`[MAILER][DEV] Destinatario: ${to}`);
    console.warn(`[MAILER][DEV] Asunto: ${subject}`);
    console.warn(`[MAILER][DEV] Enlace de recuperación: ${resetUrl}\n`);

    return {
      ok: true,
      sent: false,
      mode: 'development',
      preview: true,
      to,
      subject,
      resetUrl
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html
    });

    return {
      ok: true,
      sent: true,
      mode: 'smtp',
      messageId: info?.messageId || null,
      to,
      subject,
      resetUrl
    };
  } catch (sendError) {
    if (isDevelopmentMode()) {
      console.warn('\n[MAILER][DEV] Error al enviar correo real. Fallback a modo preview.');
      console.warn(`[MAILER][DEV] Error: ${sendError.message}`);
      console.warn(`[MAILER][DEV] Destinatario: ${to}`);
      console.warn(`[MAILER][DEV] Enlace de recuperación: ${resetUrl}\n`);

      return {
        ok: true,
        sent: false,
        mode: 'development',
        preview: true,
        to,
        subject,
        resetUrl
      };
    }
    throw sendError;
  }
}

module.exports = {
  sendPasswordResetEmail
};