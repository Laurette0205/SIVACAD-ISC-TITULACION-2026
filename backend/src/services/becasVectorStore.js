'use strict';

const crypto = require('crypto');

let OFFICIAL_BECAS_CATALOG = [];
let searchOfficialScholarships = () => [];
let getOfficialScholarshipById = () => null;
let scholarshipToSource = (item) => item;

try {
  const official = require('./BecasEdomexService');
  OFFICIAL_BECAS_CATALOG = official.OFFICIAL_BECAS_CATALOG || [];
  searchOfficialScholarships = official.searchOfficialScholarships || searchOfficialScholarships;
  getOfficialScholarshipById = official.getScholarshipById || getOfficialScholarshipById;
  scholarshipToSource = official.scholarshipToSource || scholarshipToSource;
} catch (error) {
  console.warn('[becasVectorStore] BecasEdomexService no disponible. Se usará catálogo vacío hasta crear el módulo.');
}

const DEFAULT_BECAS_SOURCES = OFFICIAL_BECAS_CATALOG.map((item) => ({
  codigo_fuente: item.codigo,
  titulo: item.titulo,
  url_origen: item.url_origen || item.url,
  tipo_fuente: item.categoria || 'Oficial',
  fecha_publicacion: null,
  vigencia_inicio: null,
  vigencia_fin: null,
  resumen: item.resumen,
  texto_completo: [
    item.descripcion,
    `Requisitos: ${(item.requisitos || []).join(' | ')}`,
    `Beneficios: ${(item.beneficios || []).join(' | ')}`,
    `Vigencia: ${item.vigencia?.ciclo || item.vigencia?.registro || 'Consultar convocatoria vigente'}`
  ].join('\n\n'),
  activo: 1,
  metadata_json: {
    categoria: item.categoria,
    alcance: item.alcance,
    nivel: item.nivel,
    estado: item.estado,
    palabrasClave: item.palabrasClave
  }
}));

// ...el resto del archivo se queda igual

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function tokenize(value) {
  return normalize(value)
    .toLowerCase()
    .split(/[^a-z0-9ñ]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function simpleEmbed(text, dimension = 64) {
  const vector = Array.from({ length: dimension }, () => 0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const digest = crypto.createHash('md5').update(token).digest();
    const index = digest.readUInt32BE(0) % dimension;
    const weight = 1 + (digest[1] % 3);
    vector[index] += weight;
  }

  const norm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0));
  if (norm > 0) {
    return vector.map((n) => Number((n / norm).toFixed(8)));
  }

  return vector;
}

function cosineSimilarity(a = [], b = []) {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i += 1) {
    const av = Number(a[i] || 0);
    const bv = Number(b[i] || 0);
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function chunkText(text, size = 900, overlap = 120) {
  const clean = normalize(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const parts = [];
  let cursor = 0;

  while (cursor < clean.length) {
    const end = Math.min(clean.length, cursor + size);
    let chunk = clean.slice(cursor, end);

    if (end < clean.length) {
      const breakIndex = Math.max(
        chunk.lastIndexOf('. '),
        chunk.lastIndexOf('; '),
        chunk.lastIndexOf(' · '),
        chunk.lastIndexOf('\n')
      );

      if (breakIndex > size * 0.45) {
        chunk = chunk.slice(0, breakIndex + 1);
        cursor = cursor + chunk.length - overlap;
      } else {
        cursor = end - overlap;
      }
    } else {
      cursor = end;
    }

    const trimmed = chunk.trim();
    if (trimmed) parts.push(trimmed);

    if (cursor <= 0) cursor = end;
  }

  return parts;
}

async function ensureBecasTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS becas_fuentes (
      id_fuente BIGINT AUTO_INCREMENT PRIMARY KEY,
      codigo_fuente VARCHAR(80) NOT NULL UNIQUE,
      titulo VARCHAR(255) NOT NULL,
      url_origen VARCHAR(700) NOT NULL,
      tipo_fuente VARCHAR(80) DEFAULT 'OFICIAL',
      fecha_publicacion DATE NULL,
      vigencia_inicio DATE NULL,
      vigencia_fin DATE NULL,
      resumen TEXT NULL,
      texto_completo LONGTEXT NULL,
      activo TINYINT(1) DEFAULT 1,
      metadata_json LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_becas_fuentes_url (url_origen(255))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS becas_chunks (
      id_chunk BIGINT AUTO_INCREMENT PRIMARY KEY,
      id_fuente BIGINT NOT NULL,
      chunk_index INT NOT NULL,
      chunk_text LONGTEXT NOT NULL,
      chunk_hash VARCHAR(64) NOT NULL,
      embedding_json LONGTEXT NULL,
      metadata_json LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_becas_chunk (id_fuente, chunk_index),
      UNIQUE KEY uq_becas_chunk_hash (chunk_hash),
      INDEX idx_becas_chunks_fuente (id_fuente),
      CONSTRAINT fk_becas_chunks_fuente FOREIGN KEY (id_fuente) REFERENCES becas_fuentes(id_fuente) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

function normalizeSourceDescriptor(source = {}, index = 0) {
  return {
    codigo_fuente: String(source.codigo_fuente || source.codigo || `FUENTE_${index + 1}`).trim(),
    titulo: String(source.titulo || source.nombre || `Fuente ${index + 1}`).trim(),
    url_origen: String(source.url_origen || source.url || '').trim(),
    tipo_fuente: String(source.tipo_fuente || 'OFICIAL').trim(),
    fecha_publicacion: source.fecha_publicacion || null,
    vigencia_inicio: source.vigencia_inicio || null,
    vigencia_fin: source.vigencia_fin || null,
    resumen: source.resumen || null,
    texto_completo: source.texto_completo || null,
    activo: Number(source.activo ?? 1) ? 1 : 0,
    metadata_json: source.metadata_json || null
  };
}

async function upsertSource(pool, source) {
  const normalized = normalizeSourceDescriptor(source);

  await pool.query(
    `
    INSERT INTO becas_fuentes
      (codigo_fuente, titulo, url_origen, tipo_fuente, fecha_publicacion, vigencia_inicio, vigencia_fin, resumen, texto_completo, activo, metadata_json)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      titulo = VALUES(titulo),
      tipo_fuente = VALUES(tipo_fuente),
      fecha_publicacion = VALUES(fecha_publicacion),
      vigencia_inicio = VALUES(vigencia_inicio),
      vigencia_fin = VALUES(vigencia_fin),
      resumen = VALUES(resumen),
      texto_completo = VALUES(texto_completo),
      activo = VALUES(activo),
      metadata_json = VALUES(metadata_json),
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      normalized.codigo_fuente,
      normalized.titulo,
      normalized.url_origen,
      normalized.tipo_fuente,
      normalized.fecha_publicacion,
      normalized.vigencia_inicio,
      normalized.vigencia_fin,
      normalized.resumen,
      normalized.texto_completo,
      normalized.activo,
      normalized.metadata_json ? JSON.stringify(normalized.metadata_json) : null
    ]
  );

  const [rows] = await pool.query(
    `SELECT * FROM becas_fuentes WHERE codigo_fuente = ? LIMIT 1`,
    [normalized.codigo_fuente]
  );

  return rows?.[0] || null;
}

async function replaceChunks(pool, sourceId, chunks = [], metadata = {}) {
  await pool.query(`DELETE FROM becas_chunks WHERE id_fuente = ?`, [sourceId]);

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = String(chunks[i] || '').trim();
    if (!chunk) continue;

    const embedding = simpleEmbed(chunk);
    const chunkHash = crypto.createHash('sha256').update(`${sourceId}:${i}:${chunk}`).digest('hex');

    await pool.query(
      `
      INSERT INTO becas_chunks
        (id_fuente, chunk_index, chunk_text, chunk_hash, embedding_json, metadata_json)
      VALUES
        (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        chunk_text = VALUES(chunk_text),
        chunk_hash = VALUES(chunk_hash),
        embedding_json = VALUES(embedding_json),
        metadata_json = VALUES(metadata_json)
      `,
      [
        sourceId,
        i,
        chunk,
        chunkHash,
        JSON.stringify(embedding),
        JSON.stringify(metadata)
      ]
    );
  }
}

async function ingestScholarshipsFromSources(pool, { sources = DEFAULT_BECAS_SOURCES } = {}) {
  await ensureBecasTables(pool);

  const summary = [];

  for (let index = 0; index < sources.length; index += 1) {
    const source = normalizeSourceDescriptor(sources[index], index);
    if (!source.url_origen) continue;

    const sourceRow = await upsertSource(pool, {
      ...source,
      resumen: source.resumen || source.texto_completo || source.titulo,
      texto_completo: source.texto_completo || source.resumen || source.titulo,
      metadata_json: source.metadata_json || {}
    });

    if (!sourceRow) continue;

    const chunks = chunkText(
      sourceRow.texto_completo ||
      sourceRow.resumen ||
      sourceRow.titulo ||
      ''
    );

    await replaceChunks(
      pool,
      sourceRow.id_fuente,
      chunks,
      {
        codigo_fuente: sourceRow.codigo_fuente,
        url_origen: sourceRow.url_origen,
        titulo: sourceRow.titulo
      }
    );

    summary.push({
      id_fuente: sourceRow.id_fuente,
      codigo_fuente: sourceRow.codigo_fuente,
      titulo: sourceRow.titulo,
      chunks: chunks.length
    });
  }

  return { ingested: summary.length, sources: summary };
}

async function seedOfficialScholarships(pool) {
  await ensureBecasTables(pool);

  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM becas_fuentes`);
  const total = Number(rows?.[0]?.total || 0);

  if (total === 0) {
    return ingestScholarshipsFromSources(pool, { sources: DEFAULT_BECAS_SOURCES });
  }

  return {
    ingested: 0,
    sources: [],
    seeded: false
  };
}

function normalizeDbRow(row = {}) {
  return {
    id_fuente: Number(row.id_fuente || 0),
    codigo_fuente: String(row.codigo_fuente || '').trim(),
    titulo: String(row.titulo || '').trim(),
    url_origen: String(row.url_origen || '').trim(),
    tipo_fuente: String(row.tipo_fuente || 'OFICIAL').trim(),
    fecha_publicacion: row.fecha_publicacion || null,
    vigencia_inicio: row.vigencia_inicio || null,
    vigencia_fin: row.vigencia_fin || null,
    resumen: String(row.resumen || '').trim(),
    texto_completo: String(row.texto_completo || '').trim(),
    activo: Number(row.activo || 0),
    metadata_json: row.metadata_json || null,
    snippet: String(row.chunk_text || row.resumen || row.titulo || '').trim(),
    score: Number(row.score || 0),
    vigencia_texto: row.vigencia_texto || row.vigencia || 'Consultar convocatoria vigente'
  };
}

async function searchScholarships(pool, query, { limit = 5 } = {}) {
  await seedOfficialScholarships(pool);

  const cleanQuery = normalize(query);
  const officialFallback = searchOfficialScholarships(cleanQuery, { limit: Math.max(limit, 5) });

  if (!cleanQuery) {
    return officialFallback.slice(0, limit);
  }

  const [rows] = await pool.query(
    `
    SELECT
      c.id_chunk,
      c.id_fuente,
      c.chunk_index,
      c.chunk_text,
      c.embedding_json,
      c.metadata_json,
      f.codigo_fuente,
      f.titulo,
      f.url_origen,
      f.tipo_fuente,
      f.fecha_publicacion,
      f.vigencia_inicio,
      f.vigencia_fin,
      f.resumen,
      f.texto_completo,
      f.activo
    FROM becas_chunks c
    INNER JOIN becas_fuentes f ON f.id_fuente = c.id_fuente
    WHERE f.activo = 1
    ORDER BY c.id_chunk DESC
    LIMIT 600
    `
  );

  const queryTokens = tokenize(cleanQuery);

  const scoredDb = rows.map((row) => {
    let embedding = [];
    try {
      embedding = Array.isArray(row.embedding_json) ? row.embedding_json : JSON.parse(row.embedding_json || '[]');
    } catch {
      embedding = [];
    }

    const text = [
      row.titulo,
      row.resumen,
      row.chunk_text,
      row.texto_completo,
      (row.metadata_json && typeof row.metadata_json === 'string' ? row.metadata_json : '')
    ].join(' ').toLowerCase();

    const tokenScore = queryTokens.reduce((score, token) => {
      if (token.length < 2) return score;
      return score + (text.includes(token) ? 1 : 0);
    }, 0);

    const vector = simpleEmbed(cleanQuery);
    const vectorScore = cosineSimilarity(vector, embedding);
    const score = (vectorScore * 0.7) + (tokenScore * 0.3);

    return {
      id_fuente: Number(row.id_fuente || 0),
      codigo_fuente: String(row.codigo_fuente || '').trim(),
      titulo: String(row.titulo || '').trim(),
      url_origen: String(row.url_origen || '').trim(),
      tipo_fuente: String(row.tipo_fuente || 'OFICIAL').trim(),
      fecha_publicacion: row.fecha_publicacion || null,
      vigencia_inicio: row.vigencia_inicio || null,
      vigencia_fin: row.vigencia_fin || null,
      resumen: String(row.resumen || '').trim(),
      texto_completo: String(row.texto_completo || '').trim(),
      activo: Number(row.activo || 0),
      score: Number(score.toFixed(4)),
      snippet: String(row.chunk_text || row.resumen || row.titulo || '').trim(),
      vigencia_texto: row.vigencia_inicio || row.vigencia_fin
        ? `${row.vigencia_inicio || 'Inicio pendiente'} → ${row.vigencia_fin || 'Fin pendiente'}`
        : 'Consultar convocatoria vigente'
    };
  });

  const merged = [...officialFallback, ...scoredDb]
    .map((item) => normalizeDbRow(item))
    .reduce((acc, item) => {
      const key = item.codigo_fuente || item.titulo;
      if (!acc.has(key)) acc.set(key, item);
      else {
        const current = acc.get(key);
        if ((item.score || 0) > (current.score || 0)) {
          acc.set(key, { ...current, ...item });
        }
      }
      return acc;
    }, new Map());

  return Array.from(merged.values())
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}

async function getScholarshipContext(pool, query, { limit = 5 } = {}) {
  const results = await searchScholarships(pool, query, { limit });

  const sources = [];
  const seen = new Set();

  for (const item of results) {
    const key = item.codigo_fuente || item.titulo;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(scholarshipToSource({
      id: item.id_fuente,
      codigo: item.codigo_fuente,
      titulo: item.titulo,
      url: item.url_origen,
      categoria: item.tipo_fuente,
      descripcion: item.texto_completo || item.resumen,
      resumen: item.resumen,
      requisitos: [],
      beneficios: [],
      vigencia: {
        ciclo: null,
        registro: item.vigencia_texto || 'Consultar convocatoria vigente'
      },
      estado: item.activo ? 'Vigente' : 'Inactivo'
    }));
  }

  return { results, sources };
}

async function getScholarshipById(pool, idFuente) {
  await seedOfficialScholarships(pool);

  const official = getOfficialScholarshipById(idFuente);
  if (official) {
    return scholarshipToSource(official);
  }

  const [rows] = await pool.query(
    `SELECT * FROM becas_fuentes WHERE id_fuente = ? LIMIT 1`,
    [Number(idFuente || 0)]
  );

  const row = rows?.[0];
  return row ? normalizeDbRow({
    id_fuente: row.id_fuente,
    codigo_fuente: row.codigo_fuente,
    titulo: row.titulo,
    url_origen: row.url_origen,
    tipo_fuente: row.tipo_fuente,
    fecha_publicacion: row.fecha_publicacion,
    vigencia_inicio: row.vigencia_inicio,
    vigencia_fin: row.vigencia_fin,
    resumen: row.resumen,
    texto_completo: row.texto_completo,
    activo: row.activo,
    vigencia_texto: row.vigencia_inicio || row.vigencia_fin ? `${row.vigencia_inicio || 'Inicio pendiente'} → ${row.vigencia_fin || 'Fin pendiente'}` : 'Consultar convocatoria vigente'
  }) : null;
}

module.exports = {
  DEFAULT_BECAS_SOURCES,
  ensureBecasTables,
  seedOfficialScholarships,
  ingestScholarshipsFromSources,
  searchScholarships,
  getScholarshipContext,
  getScholarshipById,
  simpleEmbed,
  chunkText
};