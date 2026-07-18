const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const {
  ensureBecasTables,
  ingestScholarshipsFromSources,
  DEFAULT_BECAS_SOURCES
} = require('../services/becasVectorStore');

async function main() {
  try {
    await ensureBecasTables(pool);

    const sourcesFromArg = process.argv.slice(2).filter(Boolean).map((value, index) => ({
      codigo_fuente: `CLI_${index + 1}`,
      titulo: `Fuente ${index + 1}`,
      url_origen: value,
      tipo_fuente: 'GACETA',
      activo: 1
    }));

    const sources = sourcesFromArg.length ? sourcesFromArg : DEFAULT_BECAS_SOURCES;

    if (!sources.length) {
      console.log('No hay fuentes configuradas para becas. Define BECAS_GACETA_URLS o pasa rutas/URLs por argumento.');
      process.exit(0);
    }

    const result = await ingestScholarshipsFromSources(pool, { sources });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error en ingestBecas:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
