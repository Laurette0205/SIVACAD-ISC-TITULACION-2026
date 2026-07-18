'use strict';

const BASE_URL = process.env.ML_API_URL || 'http://localhost:5001';
const TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS || '10000', 10);

function buildUrl(path) {
  return `${BASE_URL}${path}`;
}

async function request(method, path, body) {
  const url = buildUrl(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    clearTimeout(timer);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `ML API respondió con estado ${response.status}: ${errorBody}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      return { success: false, error: 'La solicitud a la API de ML excedió el tiempo de espera.' };
    }

    if (err.cause && err.cause.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'No se pudo conectar con el servidor de ML. Verifique que Flask esté corriendo en el puerto 5001.',
        fallback: true
      };
    }

    return { success: false, error: `Error al comunicarse con la API de ML: ${err.message}` };
  }
}

async function predictDesercion(features) {
  return request('POST', '/predict', {
    modulo: 'desercion',
    tipo: 'binario',
    features
  });
}

async function predictDesercionMulticlase(features) {
  return request('POST', '/predict', {
    modulo: 'desercion',
    tipo: 'multiclase',
    features
  });
}

async function predictBienestar(features) {
  return request('POST', '/predict', {
    modulo: 'bienestar',
    tipo: 'riesgo',
    features
  });
}

async function healthCheck() {
  return request('GET', '/health');
}

async function getModelos() {
  return request('GET', '/modelos');
}

module.exports = {
  predictDesercion,
  predictDesercionMulticlase,
  predictBienestar,
  healthCheck,
  getModelos
};
