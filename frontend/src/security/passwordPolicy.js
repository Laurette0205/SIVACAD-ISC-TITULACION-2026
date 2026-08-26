/**
 * Política de contraseñas — Frontend (fuente única: shared/security/password-policy.json)
 *
 * Este módulo SOLO analiza la contraseña. NUNCA la modifica.
 * No aplica trim(), toLowerCase(), ni ninguna transformación.
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
  symbol: 'La contraseña debe incluir al menos un símbolo.',
  mismatch: 'Las contraseñas no coinciden.'
};

const STRENGTH = {
  EMPTY: { label: '', score: 0, level: 'empty' },
  LOW: { label: 'Bajo — Contraseña débil', score: 33, level: 'low' },
  MEDIUM: { label: 'Medio — Contraseña aceptable', score: 66, level: 'medium' },
  HIGH: { label: 'Alto — Contraseña segura', score: 100, level: 'high' }
};

/**
 * Analiza una contraseña y devuelve el estado de cada requisito.
 * NO modifica la contraseña. La examina tal cual fue escrita.
 */
export function getPasswordChecks(password) {
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
 * Devuelve { valid: boolean, errors: string[] }.
 * NO modifica la contraseña.
 */
export function validatePassword(password) {
  const p = String(password ?? '');
  const errors = [];

  if (!p) {
    errors.push(MESSAGES.required);
    return { valid: false, errors };
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

  return { valid: errors.length === 0, errors };
}

/**
 * Clasifica la fuerza de la contraseña.
 * NO modifica la contraseña.
 * EMPTY | LOW | MEDIUM | HIGH
 */
export function getPasswordStrength(password) {
  const p = String(password ?? '');

  if (!p) return STRENGTH.EMPTY;

  let passed = 0;
  const total = 4;

  if (/[A-Z]/.test(p)) passed++;
  if (/[a-z]/.test(p)) passed++;
  if (/[0-9]/.test(p)) passed++;
  if (/[^A-Za-z0-9]/.test(p)) passed++;

  const lengthBonus = p.length >= POLICY.minLength && p.length <= POLICY.maxLength ? 1 : 0;
  const score = Math.round(((passed + lengthBonus) / (total + 1)) * 100);

  if (score < 40) return STRENGTH.LOW;
  if (score < 80) return STRENGTH.MEDIUM;
  return STRENGTH.HIGH;
}

/**
 * Mensajes centralizados para mostrar en UI.
 */
export const PASSWORD_MESSAGES = MESSAGES;

/**
 * Parámetros canónicos de la política.
 */
export const PASSWORD_POLICY = POLICY;
