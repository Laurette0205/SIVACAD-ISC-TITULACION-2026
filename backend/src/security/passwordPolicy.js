'use strict';

/**
 * Política de contraseñas — Backend (fuente única: shared/security/password-policy.json)
 *
 * Este módulo SOLO analiza la contraseña. NUNCA la modifica.
 * No aplica trim(), toLowerCase(), ni ninguna transformación.
 * Es la AUTORIDAD FINAL sobre validación de contraseñas.
 */

const POLICY = {
  minLength: 12,
  maxLength: 20,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true
};

const MESSAGES = {
  required: 'La contraseña es obligatoria.',
  length: 'La contraseña debe tener entre 12 y 20 caracteres.',
  minLength: 'La contraseña debe tener al menos 12 caracteres.',
  maxLength: 'La contraseña no debe exceder 20 caracteres.',
  uppercase: 'La contraseña debe incluir al menos una letra mayúscula.',
  lowercase: 'La contraseña debe incluir al menos una letra minúscula.',
  number: 'La contraseña debe incluir al menos un número.',
  symbol: 'La contraseña debe incluir al menos un símbolo.'
};

/**
 * Analiza una contraseña y devuelve el estado de cada requisito.
 * NO modifica la contraseña. La examina tal cual fue escrita.
 */
function getPasswordChecks(password) {
  const p = String(password ?? '');
  return {
    length: p.length >= POLICY.minLength && p.length <= POLICY.maxLength,
    minLength: p.length >= POLICY.minLength,
    maxLength: p.length <= POLICY.maxLength,
    uppercase: POLICY.requireUppercase ? /[A-Z]/.test(p) : true,
    lowercase: POLICY.requireLowercase ? /[a-z]/.test(p) : true,
    number: POLICY.requireNumber ? /[0-9]/.test(p) : true,
    symbol: POLICY.requireSymbol ? /[^A-Za-z0-9]/.test(p) : true
  };
}

/**
 * Valida una contraseña completa contra la política.
 * Devuelve { valid: boolean, message: string, errors: string[] }.
 * Si es inválida, `message` contiene el primer error para respuesta HTTP.
 * NO modifica la contraseña.
 */
function validatePassword(password) {
  const p = String(password ?? '');
  const errors = [];

  if (!p) {
    return { valid: false, message: MESSAGES.required, errors: [MESSAGES.required] };
  }

  if (p.length < POLICY.minLength) {
    errors.push(MESSAGES.minLength);
  }

  if (p.length > POLICY.maxLength) {
    errors.push(MESSAGES.maxLength);
  }

  if (POLICY.requireUppercase && !/[A-Z]/.test(p)) {
    errors.push(MESSAGES.uppercase);
  }

  if (POLICY.requireLowercase && !/[a-z]/.test(p)) {
    errors.push(MESSAGES.lowercase);
  }

  if (POLICY.requireNumber && !/[0-9]/.test(p)) {
    errors.push(MESSAGES.number);
  }

  if (POLICY.requireSymbol && !/[^A-Za-z0-9]/.test(p)) {
    errors.push(MESSAGES.symbol);
  }

  if (errors.length > 0) {
    return { valid: false, message: errors[0], errors };
  }

  return { valid: true, message: '', errors: [] };
}

module.exports = {
  POLICY,
  MESSAGES,
  getPasswordChecks,
  validatePassword
};
