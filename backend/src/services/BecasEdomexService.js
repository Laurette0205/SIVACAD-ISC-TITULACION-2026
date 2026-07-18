'use strict';

const BECAS_PORTAL_OFICIAL_URL = 'https://secti.edomex.gob.mx/becas';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === '') return [];
  return [value].filter(Boolean);
}

function mk(item) {
  return {
    id: Number(item.id || 0),
    codigo: String(item.codigo || '').trim(),
    titulo: String(item.titulo || '').trim(),
    institucion: String(item.institucion || '').trim(),
    categoria: String(item.categoria || 'Oficial').trim(),
    alcance: String(item.alcance || 'Estado de México').trim(),
    nivel: toArray(item.nivel),
    url: String(item.url || '').trim(),
    url_origen: String(item.url_origen || item.url || '').trim(),
    descripcion: String(item.descripcion || '').trim(),
    resumen: String(item.resumen || '').trim(),
    requisitos: toArray(item.requisitos),
    beneficios: toArray(item.beneficios),
    vigencia: {
      ciclo: item.vigencia?.ciclo || item.ciclo || null,
      registro: item.vigencia?.registro || item.registro || 'Consultar convocatoria vigente en el portal oficial.',
      notas: item.vigencia?.notas || item.notas || null
    },
    estado: String(item.estado || 'Consultar convocatoria').trim(),
    palabrasClave: toArray(item.palabrasClave).map(normalizeText),
    portal_oficial: String(item.portal_oficial || BECAS_PORTAL_OFICIAL_URL).trim(),
    fuente: String(item.fuente || 'Oficial').trim()
  };
}

const OFFICIAL_BECAS_CATALOG = [
  mk({
    id: 1,
    codigo: 'SECTI_SUPERIOR_APROVECHAMIENTO_2025',
    titulo: 'Programa Becas para el Bienestar por Aprovechamiento Académico para Educación Superior',
    institucion: 'SECTI / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Licenciatura', 'Ingeniería', 'TSU'],
    url: 'https://secti.edomex.gob.mx/beca-bienestar-educacion-superior',
    descripcion: 'Apoyo para permanencia y conclusión de estudios en universidades y tecnológicos escolarizados del Estado de México.',
    resumen: 'Apoyo mensual de $2,000 hasta en 10 ocasiones durante el ciclo escolar 2025-2026.',
    requisitos: [
      'Ser estudiante regular de una institución pública de educación superior del Estado de México.',
      'Contar con promedio mínimo de 8.5 en el periodo inmediato anterior.',
      'Residir en el Estado de México.',
      'Registrar la solicitud en el portal oficial.'
    ],
    beneficios: ['$2,000 mensuales', 'Hasta 10 ministraciones'],
    vigencia: {
      ciclo: '2025-2026',
      registro: 'Consultar convocatoria vigente en el portal oficial.'
    },
    estado: 'Vigente',
    palabrasClave: ['edomex', 'superior', 'aprovechamiento', 'universidad', 'tecnologico', 'licenciatura']
  }),

  mk({
    id: 2,
    codigo: 'SECTI_MEXIQUENSES_EXTRANJERO_2025',
    titulo: 'Becas para el Bienestar Mexiquenses en el Extranjero',
    institucion: 'SECTI / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Licenciatura', 'Ingeniería', 'TSU', 'Docentes activos'],
    url: 'https://secti.edomex.gob.mx/beca-bienestar-extranjero',
    descripcion: 'Apoyo para estancias académicas en el extranjero para estudiantes de educación superior y docentes activos del Estado de México.',
    resumen: 'Cubre inscripción, colegiatura, materiales, hospedaje, alimentación, seguro médico y boleto de avión, según convocatoria.',
    requisitos: [
      'Ser mayor de edad.',
      'Residir en el Estado de México.',
      'Ser estudiante regular de educación superior o docente activo.',
      'Contar con promedio mínimo de 8.5.',
      'Registrar la solicitud en tiempo y forma según convocatoria.'
    ],
    beneficios: [
      'Inscripción y colegiatura del curso',
      'Materiales del curso',
      'Hospedaje y alimentación',
      'Seguro internacional de gastos médicos',
      'Boleto de avión redondo',
      'Gastos personales'
    ],
    vigencia: {
      ciclo: '2025-2026',
      registro: 'Consultar convocatoria vigente en el portal oficial.'
    },
    estado: 'Vigente',
    palabrasClave: ['edomex', 'extranjero', 'movilidad', 'estancia', 'universidad', 'docente']
  }),

  mk({
    id: 3,
    codigo: 'SECTI_EXENCION_EDOMEX',
    titulo: 'Programa Becas de Exención Edomex para Escuelas Particulares incorporadas a la Secretaría de Educación',
    institucion: 'SECTI / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato', 'TSU', 'Licenciatura', 'Especialidad', 'Maestría', 'Doctorado'],
    url: 'https://secti.edomex.gob.mx/becas_escuelas_particulares',
    descripcion: 'Becas de exención total o parcial de colegiatura para escuelas particulares incorporadas al sistema estatal.',
    resumen: 'Exención total o parcial de colegiatura; puede ser completa o parcial, no menor al 25% del costo.',
    requisitos: [
      'Ser originario o acreditar vecindad en el Estado de México.',
      'No estar becado por organismo público o privado al momento de solicitar la beca.',
      'Ser alumno regular con promedio mínimo de 8.5.',
      'Registrar la solicitud y entregar documentos según convocatoria.'
    ],
    beneficios: ['Exención total o parcial de colegiatura', 'Apoyo no menor al 25%'],
    vigencia: {
      registro: 'Ver convocatoria por nivel educativo en el portal oficial.'
    },
    estado: 'Vigente',
    palabrasClave: ['edomex', 'exencion', 'escuelas particulares', 'colegiatura', 'licenciatura', 'posgrado']
  }),

  mk({
    id: 4,
    codigo: 'COMECYT_CIENCIA_INCIDENCIA_BIENESTAR',
    titulo: 'Beca Ciencia con Incidencia para el Bienestar COMECYT',
    institucion: 'COMECYT / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Licenciatura', 'TSU'],
    url: 'https://comecyt.edomex.gob.mx/ciencias-edmex',
    descripcion: 'Apoyo a estudiantes de educación superior con proyectos de incidencia orientados a su programa de estudios.',
    resumen: 'Requiere residencia en Edomex, promedio mínimo de 8.0 y programa de actividades de incidencia.',
    requisitos: [
      'Habitar en el Estado de México.',
      'Tener hasta 25 años cumplidos.',
      'Estar inscrito en educación superior.',
      'Contar con promedio mínimo de 8.0.',
      'Presentar programa de actividades de incidencia.'
    ],
    beneficios: ['Apoyo monetario según convocatoria'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en el portal COMECYT.'
    },
    estado: 'Vigente',
    palabrasClave: ['comecyt', 'ciencia', 'incidencia', 'bienestar', 'edomex', 'licenciatura']
  }),

  mk({
    id: 5,
    codigo: 'COMECYT_POSGRADO_MAESTRIA',
    titulo: 'Becas COMECYT, Modalidad Beca de Posgrado, estudios de Maestría',
    institucion: 'COMECYT / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Maestría'],
    url: 'https://comecyt.edomex.gob.mx/becas-estudiantes',
    descripcion: 'Programa estatal para apoyar estudios de posgrado en modalidad maestría.',
    resumen: 'Convocatoria oficial de COMECYT para estudios de maestría.',
    requisitos: [
      'Consultar convocatoria vigente.',
      'Cumplir los criterios académicos del programa.'
    ],
    beneficios: ['Apoyo económico según reglas de operación'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en el portal oficial de COMECYT.'
    },
    estado: 'Vigente',
    palabrasClave: ['comecyt', 'maestria', 'posgrado', 'edomex', 'beca']
  }),

  mk({
    id: 6,
    codigo: 'COMECYT_POSGRADO_SALUD',
    titulo: 'Becas COMECYT Modalidad Posgrado, Ciencias de la Salud',
    institucion: 'COMECYT / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Posgrado', 'Salud'],
    url: 'https://comecyt.edomex.gob.mx/becas-estudiantes',
    descripcion: 'Convocatoria estatal para posgrado en ciencias de la salud.',
    resumen: 'Convocatoria oficial de COMECYT para posgrado en ciencias de la salud.',
    requisitos: [
      'Consultar convocatoria vigente.',
      'Cumplir los criterios del programa.'
    ],
    beneficios: ['Apoyo económico según convocatoria'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en el portal oficial de COMECYT.'
    },
    estado: 'Vigente',
    palabrasClave: ['comecyt', 'salud', 'posgrado', 'edomex', 'beca']
  }),

  mk({
    id: 7,
    codigo: 'COMECYT_EDUCACION_DUAL',
    titulo: 'Beca de Educación Dual',
    institucion: 'COMECYT / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Superior', 'Educación dual'],
    url: 'https://comecyt.edomex.gob.mx/educacion-dual',
    descripcion: 'Apoyo para estudiantes incorporados a educación dual.',
    resumen: 'Convocatoria oficial para educación dual en el Estado de México.',
    requisitos: ['Consultar convocatoria vigente en el portal oficial.'],
    beneficios: ['Apoyo económico según convocatoria'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en el portal oficial de COMECYT.'
    },
    estado: 'Vigente',
    palabrasClave: ['comecyt', 'educacion dual', 'dual', 'edomex', 'superior']
  }),

  mk({
    id: 8,
    codigo: 'COMECYT_MUJERES_INDIGENAS_RURALES',
    titulo: 'Programa Becas COMECYT, Beca Mujeres Indígenas y Rurales Mexiquenses para estudios de Maestría',
    institucion: 'COMECYT / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Maestría'],
    url: 'https://comecyt.edomex.gob.mx/mujeres-indigenas-mexiquenses',
    descripcion: 'Apoyo a mujeres mexiquenses pertenecientes a pueblos originarios o municipios con alta población rural para cursar maestría.',
    resumen: 'Programa de formación de recursos humanos para mujeres indígenas y rurales mexiquenses.',
    requisitos: [
      'Pertenecer a pueblos originarios o habitar en municipios con alta población rural.',
      'Estar cursando maestría en una institución de educación superior del Estado de México.'
    ],
    beneficios: ['Apoyo monetario según convocatoria'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en el portal oficial de COMECYT.'
    },
    estado: 'Vigente',
    palabrasClave: ['comecyt', 'mujeres', 'indigenas', 'rurales', 'maestria', 'edomex']
  }),

  mk({
    id: 9,
    codigo: 'COMECYT_INTERNACIONAL',
    titulo: 'Programa Becas COMECYT, Modalidad Beca Internacional (Máster, Maestría y Doctorado)',
    institucion: 'COMECYT / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Maestría', 'Doctorado'],
    url: 'https://comecyt.edomex.gob.mx/beca-internacional-edomex',
    descripcion: 'Beca internacional para programas de maestría o doctorado.',
    resumen: 'Programa COMECYT para movilidad y formación internacional.',
    requisitos: [
      'Consultar convocatoria vigente.',
      'Cumplir con el área de conocimiento y reglas del programa.'
    ],
    beneficios: ['Apoyo económico según convocatoria'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en el portal oficial de COMECYT.'
    },
    estado: 'Vigente',
    palabrasClave: ['comecyt', 'internacional', 'maestria', 'doctorado', 'edomex']
  }),

  mk({
    id: 10,
    codigo: 'COMECYT_ESTANCIAS_INVESTIGACION',
    titulo: 'Programa Apoyo para Estancias de Investigación COMECYT',
    institucion: 'COMECYT / Gobierno del Estado de México',
    categoria: 'Gobierno del Estado de México',
    alcance: 'Estatal',
    nivel: ['Posgrado', 'Investigación'],
    url: 'https://comecyt.edomex.gob.mx/programa-estancias',
    descripcion: 'Programa para fortalecer capacidades de investigación científica y tecnológica.',
    resumen: 'Apoyo para estancias de investigación COMECYT.',
    requisitos: [
      'Consultar convocatoria vigente.',
      'Cumplir con los requisitos de investigación del programa.'
    ],
    beneficios: ['Apoyo económico según convocatoria'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en el portal oficial de COMECYT.'
    },
    estado: 'Vigente',
    palabrasClave: ['comecyt', 'estancias', 'investigacion', 'edomex', 'posgrado']
  }),

  mk({
    id: 11,
    codigo: 'SANTANDER_EXCELENCIA_2025',
    titulo: 'Beca Santander | de Excelencia Académica 2025',
    institucion: 'Santander Open Academy',
    categoria: 'Externa / Aliada',
    alcance: 'Nacional',
    nivel: ['Superior'],
    url: 'https://app.santanderopenacademy.com/es/program/de-excelencia-academica-2025',
    descripcion: 'Beca de Santander dirigida a estudiantes regulares con avance curricular y excelente promedio.',
    resumen: 'Requiere mínimo 30% de créditos y promedio mínimo de 8.8.',
    requisitos: [
      'Ser estudiante con mínimo 30% de créditos en su plan de estudios.',
      'Ser estudiante regular con promedio mínimo de 8.8.'
    ],
    beneficios: ['Apoyo según convocatoria Santander'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en Santander Open Academy.'
    },
    estado: 'Consultar convocatoria',
    palabrasClave: ['santander', 'excelencia', 'academica', 'universidad', 'apoyo']
  }),

  mk({
    id: 12,
    codigo: 'SANTANDER_MANUTENCION_2025',
    titulo: 'Beca Santander | Apoyo a la manutención 2025',
    institucion: 'Santander Open Academy',
    categoria: 'Externa / Aliada',
    alcance: 'Nacional',
    nivel: ['Superior'],
    url: 'https://app.santanderopenacademy.com/es/program/apoyo-a-la-manutencion-2025',
    descripcion: 'Apoyo económico para manutención de estudiantes universitarios.',
    resumen: 'Monto único de $9,000 MXN, 300 becas disponibles.',
    requisitos: [
      'Consultar convocatoria vigente en Santander Open Academy.'
    ],
    beneficios: ['$9,000 MXN en un solo apoyo'],
    vigencia: {
      registro: 'Consultar convocatoria vigente en Santander Open Academy.'
    },
    estado: 'Consultar convocatoria',
    palabrasClave: ['santander', 'manutencion', 'apoyo', 'universidad', 'beca']
  }),

  mk({
    id: 13,
    codigo: 'BBVA_FUNDACION_CHAVOS_INSPIRAN',
    titulo: 'Fundación BBVA | Chavos que Inspiran',
    institucion: 'Fundación BBVA',
    categoria: 'Externa / Aliada',
    alcance: 'Nacional',
    nivel: ['Secundaria', 'Bachillerato', 'Universidad'],
    url: 'https://portal.bbva.mx/fundacion/',
    descripcion: 'Programa de Fundación BBVA con becas económicas, asesoría académica, vocacional y psicológica.',
    resumen: 'Becas económicas desde secundaria hasta universidad con acompañamiento integral.',
    requisitos: [
      'Consultar convocatoria vigente de Fundación BBVA.',
      'Mantener promedio mínimo y compromisos del programa.'
    ],
    beneficios: [
      'Beca económica',
      'Seguro médico de becarios',
      'Asesorías académicas, vocacionales y psicológicas'
    ],
    vigencia: {
      registro: 'Consultar convocatoria vigente en Fundación BBVA.'
    },
    estado: 'Consultar convocatoria',
    palabrasClave: ['bbva', 'fundacion', 'chavos que inspiran', 'universidad', 'beca']
  }),

  mk({
    id: 14,
    codigo: 'BBVA_FUNDACION_DISCAPACIDAD',
    titulo: 'Fundación BBVA | Chavos con Discapacidad que Inspiran',
    institucion: 'Fundación BBVA',
    categoria: 'Externa / Aliada',
    alcance: 'Nacional',
    nivel: ['Secundaria', 'Bachillerato', 'Universidad'],
    url: 'https://portal.bbva.mx/fundacion/',
    descripcion: 'Programa de inclusión educativa con apoyo económico y continuidad escolar.',
    resumen: 'Programa de beca e inclusión educativa para estudiantes con discapacidad.',
    requisitos: [
      'Consultar convocatoria vigente de Fundación BBVA.'
    ],
    beneficios: [
      'Beca económica',
      'Continuidad escolar',
      'Acompañamiento'
    ],
    vigencia: {
      registro: 'Consultar convocatoria vigente en Fundación BBVA.'
    },
    estado: 'Consultar convocatoria',
    palabrasClave: ['bbva', 'discapacidad', 'inclusion', 'universidad', 'beca']
  })
];

function buildSearchCorpus(item) {
  return [
    item.titulo,
    item.institucion,
    item.categoria,
    item.alcance,
    item.descripcion,
    item.resumen,
    (item.requisitos || []).join(' '),
    (item.beneficios || []).join(' '),
    (item.palabrasClave || []).join(' '),
    item.vigencia?.ciclo || '',
    item.vigencia?.registro || '',
    item.estado || ''
  ]
    .join(' ')
    .toLowerCase();
}

function scoreScholarship(query, item) {
  const q = normalizeText(query).toLowerCase();
  if (!q) return 0;

  const corpus = buildSearchCorpus(item);
  const tokens = q.split(/[^a-z0-9ñ]+/i).map((t) => t.trim()).filter(Boolean);

  let score = 0;

  if (corpus.includes(q)) score += 10;
  if (normalizeText(item.titulo).toLowerCase().includes(q)) score += 6;
  if (normalizeText(item.institucion).toLowerCase().includes(q)) score += 3;

  for (const token of tokens) {
    if (token.length < 2) continue;
    if (corpus.includes(token)) score += 1.5;
    if (normalizeText(item.titulo).toLowerCase().includes(token)) score += 2.2;
    if ((item.palabrasClave || []).some((k) => normalizeText(k).toLowerCase().includes(token))) score += 1.8;
  }

  if (q.includes('edomex') || q.includes('estado de mexico') || q.includes('estado de méxico')) {
    if (normalizeText(item.categoria).toLowerCase().includes('estado de mexico')) score += 2;
    if (normalizeText(item.url).includes('secti.edomex.gob.mx')) score += 1.5;
  }

  if (q.includes('universidad') || q.includes('superior') || q.includes('licenciatura')) {
    if ((item.nivel || []).some((n) => normalizeText(n).toLowerCase().includes('licenci'))) score += 2;
    if ((item.nivel || []).some((n) => normalizeText(n).toLowerCase().includes('superior'))) score += 1.5;
  }

  return score;
}

function buildScholarshipSummary(item) {
  if (!item) return 'Sin información disponible.';
  const requisitos = (item.requisitos || []).slice(0, 2).join(' · ');
  const vigencia = item.vigencia?.ciclo || item.vigencia?.registro || 'Consulta la convocatoria vigente.';
  return `${item.titulo}. ${item.resumen || item.descripcion || ''} ${vigencia}${requisitos ? `. Requisitos clave: ${requisitos}` : ''}`;
}

function scholarshipToSource(item) {
  const normalized = mk(item);
  return {
    id_fuente: normalized.id,
    codigo_fuente: normalized.codigo,
    titulo: normalized.titulo,
    url_origen: normalized.url_origen,
    tipo_fuente: normalized.categoria,
    fecha_publicacion: null,
    vigencia_inicio: null,
    vigencia_fin: null,
    vigencia_texto: normalized.vigencia?.ciclo
      ? `Ciclo ${normalized.vigencia.ciclo}`
      : normalized.vigencia?.registro || 'Consultar convocatoria vigente',
    resumen: normalized.resumen,
    descripcion: normalized.descripcion,
    estado: normalized.estado,
    alcance: normalized.alcance,
    nivel: normalized.nivel,
    portal_oficial: normalized.portal_oficial
  };
}

function getScholarshipById(idOrCode) {
  const key = String(idOrCode || '').trim();
  if (!key) return null;

  const byId = OFFICIAL_BECAS_CATALOG.find((item) => String(item.id) === key);
  if (byId) return byId;

  const byCode = OFFICIAL_BECAS_CATALOG.find(
    (item) => normalizeText(item.codigo).toLowerCase() === normalizeText(key).toLowerCase()
  );
  if (byCode) return byCode;

  return OFFICIAL_BECAS_CATALOG.find(
    (item) =>
      normalizeText(item.titulo).toLowerCase().includes(normalizeText(key).toLowerCase()) ||
      normalizeText(item.resumen).toLowerCase().includes(normalizeText(key).toLowerCase())
  ) || null;
}

function searchOfficialScholarships(query, { limit = 5 } = {}) {
  const q = normalizeText(query);
  const items = OFFICIAL_BECAS_CATALOG.map((item) => {
    const score = scoreScholarship(q, item);
    return {
      ...scholarshipToSource(item),
      codigo: item.codigo,
      institucion: item.institucion,
      categoria: item.categoria,
      alcance: item.alcance,
      nivel: item.nivel,
      requisitos: item.requisitos,
      beneficios: item.beneficios,
      vigencia: item.vigencia,
      score: Number(score.toFixed(4)),
      snippet: buildScholarshipSummary(item)
    };
  });

  const ranked = items
    .filter((item) => !q || item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.titulo).localeCompare(String(b.titulo), 'es');
    });

  return ranked.slice(0, Math.max(1, Number(limit) || 5));
}

function buildScholarshipNotification(items = []) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    return {
      title: 'Catálogo oficial de becas',
      message: `Consulta el portal oficial de becas en ${BECAS_PORTAL_OFICIAL_URL} para revisar convocatorias vigentes y sus fechas.`,
      actionLabel: 'Abrir portal oficial',
      actionUrl: BECAS_PORTAL_OFICIAL_URL,
      variant: 'info',
      items: []
    };
  }

  const active = list.filter((item) => {
    const status = normalizeText(item.estado || '');
    return status.includes('VIGENTE') || status.includes('ABIERTA') || status.includes('DISPONIBLE');
  });

  const top = list[0];
  const title = active.length > 0
    ? `${active.length} programa(s) detectado(s)`
    : `${list.length} programa(s) relacionado(s)`;

  return {
    title,
    message: buildScholarshipSummary(top),
    actionLabel: 'Ver convocatoria',
    actionUrl: top.url_origen || top.url || BECAS_PORTAL_OFICIAL_URL,
    variant: active.length > 0 ? 'success' : 'info',
    items: list.slice(0, 3).map(scholarshipToSource)
  };
}

module.exports = {
  BECAS_PORTAL_OFICIAL_URL,
  OFFICIAL_BECAS_CATALOG,
  searchOfficialScholarships,
  getScholarshipById,
  buildScholarshipSummary,
  buildScholarshipNotification,
  scholarshipToSource
};